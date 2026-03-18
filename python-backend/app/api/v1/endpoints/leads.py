import uuid
import csv
import io
import json
import os
from datetime import datetime
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends, Response, UploadFile, File, Form, Query
from sqlalchemy.orm import Session
from app.core.database import get_db, SessionLocal
from app.core.supabase import supabase
from app.models import Lead, Session as DbSession, Transcript, Appointment, Document, PipelineHistory
from app.schemas.lead import LeadCreate, Lead as LeadSchema, SessionCreate, SessionUpdate, EmployerLeadCreate
from app.schemas.common import INDIVIDUAL_PIPELINE_STAGES, GROUP_PIPELINE_STAGES, ALL_PIPELINE_STAGES
from app.services.integrations.ghl import ghl_service
from pydantic import BaseModel

router = APIRouter()

class LeadPipelineUpdate(BaseModel):
    pipelineStatus: str


class LeadSessionPatch(BaseModel):
    notes: Optional[str] = None
    status: Optional[str] = None
    disposition: Optional[str] = None
    callSummary: Optional[str] = None
    complianceFlags: Optional[Dict[str, Any]] = None
    actionItems: Optional[Any] = None


def _ensure_session_for_lead(db: Session, lead_id: str) -> DbSession | None:
    session = db.query(DbSession).filter(DbSession.leadId == lead_id).first()
    if session:
        return session

    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if not lead:
        return None

    session = DbSession(
        id=str(uuid.uuid4()),
        leadId=lead_id,
        status="new",
        createdAt=datetime.utcnow(),
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


def _serialize_transcript(row: Transcript) -> Dict[str, Any]:
    return {
        "id": row.id,
        "role": row.role,
        "content": row.content,
        "timestamp": row.timestamp.isoformat() if row.timestamp else None,
        "createdAt": row.createdAt.isoformat() if row.createdAt else None,
    }


def _serialize_session(session: DbSession, include_transcripts: bool = False) -> Dict[str, Any]:
    payload: Dict[str, Any] = {
        "id": session.id,
        "leadId": session.leadId,
        "status": session.status,
        "startTime": session.startTime,
        "endTime": session.endTime,
        "disposition": session.disposition,
        "notes": session.notes,
        "planName": session.planName,
        "premium": session.premium,
        "ghlContactId": session.ghlContactId,
        "callSummary": session.callSummary,
        "recordingLink": session.recordingLink,
        "transcriptLink": session.transcriptLink,
        "citationsBundleLink": session.citationsBundleLink,
        "complianceFlags": session.complianceFlags,
        "actionItems": session.actionItems,
        "createdAt": session.createdAt,
        "updatedAt": session.updatedAt,
    }

    if include_transcripts:
        transcript_rows = (
            session.transcripts
            if isinstance(session.transcripts, list)
            else []
        )
        payload["transcripts"] = [_serialize_transcript(row) for row in transcript_rows]

    return payload


def _extract_signed_url(signed_url_payload: Any) -> Optional[str]:
    if not signed_url_payload:
        return None

    if isinstance(signed_url_payload, str):
        return signed_url_payload

    if isinstance(signed_url_payload, dict):
        for key in ("signedURL", "signedUrl", "signed_url", "url"):
            value = signed_url_payload.get(key)
            if isinstance(value, str) and value:
                return value

        nested = signed_url_payload.get("data")
        if isinstance(nested, dict):
            for key in ("signedURL", "signedUrl", "signed_url", "url"):
                value = nested.get(key)
                if isinstance(value, str) and value:
                    return value

    for attr in ("signedURL", "signedUrl", "signed_url", "url"):
        value = getattr(signed_url_payload, attr, None)
        if isinstance(value, str) and value:
            return value

    return None


def _serialize_lead(lead: Lead) -> Dict[str, Any]:
    data = {
        "id": lead.id,
        "createdAt": lead.createdAt,
        "updatedAt": lead.updatedAt,
        "leadType": lead.leadType or "individual",
        "productType": lead.productType,
        "state": lead.state,
        "triggers": lead.triggers,
        "firstName": lead.firstName,
        "lastName": lead.lastName,
        "email": lead.email,
        "phone": lead.phone,
        "utmSource": lead.utmSource,
        "utmMedium": lead.utmMedium,
        "utmCampaign": lead.utmCampaign,
        "utmTerm": lead.utmTerm,
        "utmContent": lead.utmContent,
        "pipelineStatus": lead.pipelineStatus or "new",
        # Employer / Group fields
        "companyName": lead.companyName,
        "contactPerson": lead.contactPerson,
        "numEmployees": lead.numEmployees,
        "numEligible": lead.numEligible,
        "industry": lead.industry,
        "renewalDate": lead.renewalDate.isoformat() if lead.renewalDate else None,
        "currentCarrier": lead.currentCarrier,
        "currentPlan": lead.currentPlan,
        "contributionStrategy": lead.contributionStrategy,
        "benefitsNeeded": lead.benefitsNeeded,
        "groupNotes": lead.groupNotes,
    }
    return data


# Background Task Functions
async def sync_lead_to_ghl(lead_id: str):
    db = SessionLocal()
    try:
        # Fetch Lead and Session
        session = db.query(DbSession).filter(DbSession.leadId == lead_id).first()
        if not session or not session.lead:
            print(f"Sync Error: Lead/Session {lead_id} not found")
            return
            
        lead = session.lead
        
        # Prepare GHL Contact Data
        contact_data = {
            "email": lead.email,
            "phone": lead.phone,
            "firstName": lead.firstName,
            "lastName": lead.lastName,
            "tags": [f"Lead Source: {lead.utmSource or 'Direct'}", f"Product: {lead.productType}"],
            "customFields": {
                "state": lead.state,
                "triggers": str(lead.triggers) # GHL custom fields are usually strings
            }
        }
        
        # Sync to GHL
        ghl_contact = await ghl_service.create_contact(contact_data)
        
        if ghl_contact and ghl_contact.get("contact", {}).get("id"):
            contact_id = ghl_contact["contact"]["id"]
            session.ghlContactId = contact_id
            db.commit()
            print(f"✅ Synced lead {lead_id} to GHL: {contact_id}")
            
    except Exception as e:
        print(f"Error syncing lead to GHL: {e}")
    finally:
        db.close()

async def sync_wrapup_to_ghl(lead_id: str):
    db = SessionLocal()
    try:
        session = db.query(DbSession).filter(DbSession.leadId == lead_id).first()
        if not session or not session.ghlContactId:
            print(f"Sync Skip: No GHL ID for session {lead_id}")
            return
            
        # Update Contact Fields
        update_data = {
            "tags": [f"Disposition: {session.disposition}"],
            "customFields": {
                "plan_sold": session.planName,
                "premium_amount": session.premium,
                # New Fields
                "call_summary": session.callSummary,
                "recording_link": session.recordingLink,
                "citations_link": session.citationsBundleLink
            }
        }
        
        # Add compliance warnings as tag if any
        if session.complianceFlags:
             # Just an example logic:
             flags = session.complianceFlags
             if isinstance(flags, dict):
                 if not flags.get("disclaimerRead"):
                     update_data["tags"].append("Compliance: Missing Disclaimer")
                 if flags.get("forbiddenTopics"):
                     update_data["tags"].append("Compliance: Forbidden Topic")
        
        await ghl_service.update_contact(session.ghlContactId, update_data)
        
        # Add Note
        if session.notes:
            await ghl_service.add_note(session.ghlContactId, f"Call Notes: {session.notes}")
            
        print(f"✅ Synced wrap-up for {lead_id} to GHL")
        
    except Exception as e:
        print(f"Error syncing wrapup to GHL: {e}")
    finally:
        db.close()


@router.post("/intake", response_model=Dict[str, Any])
async def create_lead_intake(
    lead_in: LeadCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Receives intake data (product, state, triggers, UTMs)
    Returns a leadId (session ID)
    """
    try:
        # 1. Create Lead
        lead_id = str(uuid.uuid4())
        
        # Safe extraction of triggers if it exists in schema
        triggers_data = getattr(lead_in, "triggers", {})
        
        db_lead = Lead(
            id=lead_id,
            productType=lead_in.product_type,
            state=lead_in.state,
            triggers=triggers_data,
            firstName=lead_in.first_name,
            lastName=lead_in.last_name,
            email=lead_in.email,
            phone=lead_in.phone,
            utmSource=lead_in.utm_source,
            utmMedium=lead_in.utm_medium,
            utmCampaign=lead_in.utm_campaign,
            utmTerm=lead_in.utm_term,
            utmContent=lead_in.utm_content
        )
        db.add(db_lead)
        db.flush() 
        
        # 2. Create Session
        session_id = str(uuid.uuid4())
        db_session = DbSession(
            id=session_id,
            leadId=lead_id,
            status="new",
            createdAt=datetime.utcnow()
        )
        db.add(db_session)
        
        db.commit()
        db.refresh(db_lead)
        
        # 3. Trigger Background Tasks (Sync to GHL)
        if lead_in.email or lead_in.phone:
            background_tasks.add_task(sync_lead_to_ghl, lead_id)

        # 4. Create Notification
        from app.services.notification_service import notification_service
        background_tasks.add_task(
            notification_service.create_notification,
            type="lead",
            title="New Lead Captured",
            message=f"{lead_in.first_name} {lead_in.last_name} - {lead_in.product_type}",
            metadata={"leadId": lead_id}
        )

        return {"success": True, "leadId": lead_id}

    except Exception as e:
        db.rollback()
        print(f"Error in lead intake: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/", response_model=List[Dict[str, Any]])
async def get_leads(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """
    Retrieve all leads (with latest session status)
    """
    try:
        leads = (
            db.query(Lead)
            .order_by(Lead.createdAt.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )
        
        leads_list = []
        for lead in leads:
            session = lead.session
            leads_list.append({
                "id": lead.id,
                "leadType": lead.leadType or "individual",
                "firstName": lead.firstName,
                "lastName": lead.lastName,
                "email": lead.email,
                "phone": lead.phone,
                "productType": lead.productType,
                "state": lead.state,
                "pipelineStatus": lead.pipelineStatus or "new",
                "createdAt": lead.createdAt,
                "companyName": lead.companyName,
                # Session lifecycle status (new, completed, etc.) kept for compatibility.
                "status": session.status if session else "new",
                "disposition": session.disposition if session else None
            })
        return leads_list

    except Exception as e:
        print(f"Error fetching leads: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{lead_id}", response_model=Dict[str, Any])
async def get_lead_session(
    lead_id: str,
    db: Session = Depends(get_db)
):
    """
    Retrieve lead session context
    """
    try:
        lead = db.query(Lead).filter(Lead.id == lead_id).first()
        if not lead:
            raise HTTPException(status_code=404, detail="Lead not found")

        session = _ensure_session_for_lead(db, lead_id)

        transcript_rows: List[Transcript] = []
        if session:
            transcript_rows = (
                db.query(Transcript)
                .filter(Transcript.sessionId == session.id)
                .order_by(Transcript.timestamp.asc())
                .all()
            )

        transcriptions = []
        ai_responses = []
        full_chat = []
        for row in transcript_rows:
            item = _serialize_transcript(row)
            if row.role == "customer":
                transcriptions.append(item)
            elif row.role == "ai":
                ai_responses.append(item)
            full_chat.append(item)

        response = _serialize_lead(lead)
        response.update({
            # Flattened fields for existing frontend compatibility
            "startTime": session.startTime if session else None,
            "status": session.status if session else "new",
            "ghlContactId": session.ghlContactId if session else None,
            "callSummary": session.callSummary if session else None,
            "complianceFlags": session.complianceFlags if session else None,
            "actionItems": session.actionItems if session else None,
            # Rich nested session payload for profile page
            "session": _serialize_session(session, include_transcripts=False) if session else None,
            # Persisted meeting artifacts to show in client profile
            "meetingArtifacts": {
                "sessionId": session.id if session else None,
                "transcriptions": transcriptions,
                "aiResponses": ai_responses,
                "fullChat": full_chat,
                "summary": {
                    "callSummary": session.callSummary if session else None,
                    "complianceFlags": session.complianceFlags if session else None,
                    "actionItems": session.actionItems if session else None,
                },
            }
        })

        if response.get("session") is not None:
            response["session"]["transcripts"] = full_chat

        return response
        
    except HTTPException:
        raise
    except Exception as e:
         print(f"Error fetching lead: {str(e)}")
         raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{lead_id}", response_model=Dict[str, Any])
async def delete_lead(
    lead_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """
    Permanently delete a lead (client) and related records:
    - transcripts
    - session
    - appointments
    - documents (DB metadata)
    """
    try:
        lead = db.query(Lead).filter(Lead.id == lead_id).first()
        if not lead:
            raise HTTPException(status_code=404, detail="Lead not found")

        lead_name = f"{lead.firstName or ''} {lead.lastName or ''}".strip() or "Unknown client"
        session = db.query(DbSession).filter(DbSession.leadId == lead_id).first()

        deleted_transcripts = 0
        if session:
            deleted_transcripts = (
                db.query(Transcript)
                .filter(Transcript.sessionId == session.id)
                .delete(synchronize_session=False)
            )
            db.delete(session)

        deleted_appointments = (
            db.query(Appointment)
            .filter(Appointment.leadId == lead_id)
            .delete(synchronize_session=False)
        )
        deleted_documents = (
            db.query(Document)
            .filter(Document.leadId == lead_id)
            .delete(synchronize_session=False)
        )

        db.delete(lead)
        db.commit()

        from app.services.notification_service import notification_service
        background_tasks.add_task(
            notification_service.create_notification,
            type="lead",
            title="Client Deleted",
            message=f"{lead_name} was deleted by admin",
            metadata={"leadId": lead_id},
        )

        return {
            "success": True,
            "deleted": {
                "leadId": lead_id,
                "leadName": lead_name,
                "appointments": deleted_appointments,
                "documents": deleted_documents,
                "transcripts": deleted_transcripts,
                "session": 1 if session else 0,
            },
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"Error deleting lead: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/{lead_id}", response_model=Dict[str, Any])
async def update_lead_pipeline_status(
    lead_id: str,
    update: LeadPipelineUpdate,
    db: Session = Depends(get_db),
):
    """
    Update lead pipeline status.
    Individual stages: new, appointment_booked, quoted, enrolled, lost
    Group stages: new_lead, contacted, discovery_scheduled, census_requested,
                  census_received, sent_to_warner, quotes_received,
                  proposal_presented, closed_won, closed_lost, renewal_followup
    """
    try:
        next_status = (update.pipelineStatus or "").strip().lower()
        if next_status not in ALL_PIPELINE_STAGES:
            raise HTTPException(status_code=400, detail="Invalid pipeline status")

        lead = db.query(Lead).filter(Lead.id == lead_id).first()
        if not lead:
            raise HTTPException(status_code=404, detail="Lead not found")

        previous_status = lead.pipelineStatus

        lead.pipelineStatus = next_status
        db.flush()

        # Record pipeline history
        history = PipelineHistory(
            id=str(uuid.uuid4()),
            leadId=lead_id,
            fromStage=previous_status,
            toStage=next_status,
            notes=getattr(update, "notes", None),
        )
        db.add(history)
        db.commit()
        db.refresh(lead)

        return {
            "success": True,
            "lead": {
                "id": lead.id,
                "pipelineStatus": lead.pipelineStatus or "new",
                "previousStatus": previous_status,
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"Error updating lead pipeline status: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/{lead_id}/session", response_model=Dict[str, Any])
async def update_lead_session(
    lead_id: str,
    update: LeadSessionPatch,
    db: Session = Depends(get_db),
):
    """
    Patch lead session fields (notes/status/disposition/summary metadata).
    Auto-creates a session for valid leads when missing.
    """
    try:
        session = _ensure_session_for_lead(db, lead_id)
        if not session:
            raise HTTPException(status_code=404, detail="Lead not found")

        if update.notes is not None:
            session.notes = update.notes
        if update.status is not None:
            session.status = update.status
        if update.disposition is not None:
            session.disposition = update.disposition
            if update.disposition:
                session.endTime = session.endTime or datetime.utcnow()
        if update.callSummary is not None:
            session.callSummary = update.callSummary
        if update.complianceFlags is not None:
            session.complianceFlags = update.complianceFlags
        if update.actionItems is not None:
            session.actionItems = update.actionItems

        db.commit()
        db.refresh(session)
        return {
            "success": True,
            "session": _serialize_session(session, include_transcripts=False),
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"Error updating lead session: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{lead_id}/recording", response_model=Dict[str, Any])
async def upload_meeting_recording(
    lead_id: str,
    file: UploadFile = File(...),
    meeting_id: Optional[str] = Form(None),
    db: Session = Depends(get_db),
):
    """
    Upload full meeting audio for a lead and persist storage path into Session.recordingLink.
    Audio bytes are stored in Supabase Storage (client-docs bucket).
    """
    try:
        session = _ensure_session_for_lead(db, lead_id)
        if not session:
            raise HTTPException(status_code=404, detail="Lead not found")

        if not file:
            raise HTTPException(status_code=400, detail="Recording file is required")

        if not supabase:
            raise HTTPException(status_code=500, detail="Supabase client not initialized")

        content = await file.read()
        if not content:
            raise HTTPException(status_code=400, detail="Recording file is empty")

        bucket_name = "client-docs"
        ext = os.path.splitext(file.filename or "")[1].lower()
        if ext not in {".webm", ".mp4", ".m4a", ".wav", ".ogg"}:
            ext = ".webm"

        unique_name = f"{session.id}-{uuid.uuid4()}{ext}"
        storage_path = f"recordings/{lead_id}/{unique_name}"
        content_type = file.content_type or "audio/webm"

        try:
            supabase.storage.from_(bucket_name).upload(
                path=storage_path,
                file=content,
                file_options={"content-type": content_type}
            )
        except Exception as upload_error:
            print(f"Meeting recording upload error: {upload_error}")
            raise HTTPException(status_code=500, detail="Failed to upload meeting recording")

        previous_recording_path = session.recordingLink
        session.recordingLink = storage_path
        db.commit()
        db.refresh(session)

        # Best-effort cleanup for superseded recording file.
        if previous_recording_path and previous_recording_path != storage_path:
            try:
                supabase.storage.from_(bucket_name).remove([previous_recording_path])
            except Exception as cleanup_error:
                print(f"Superseded recording cleanup skipped: {cleanup_error}")

        signed_url = None
        try:
            signed_payload = supabase.storage.from_(bucket_name).create_signed_url(storage_path, 3600)
            signed_url = _extract_signed_url(signed_payload)
        except Exception as signed_error:
            print(f"Signed URL generation skipped after upload: {signed_error}")

        return {
            "success": True,
            "leadId": lead_id,
            "sessionId": session.id,
            "meetingId": meeting_id,
            "recording": {
                "path": storage_path,
                "url": signed_url,
                "contentType": content_type,
                "size": len(content),
            },
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"Error saving meeting recording: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{lead_id}/recording", response_model=Dict[str, Any])
async def get_meeting_recording(
    lead_id: str,
    expires_in: int = Query(default=3600, ge=60, le=86400),
    db: Session = Depends(get_db),
):
    """
    Return the persisted recording path and a signed playback URL for the lead session.
    """
    try:
        session = _ensure_session_for_lead(db, lead_id)
        if not session:
            raise HTTPException(status_code=404, detail="Lead not found")

        recording_path = session.recordingLink
        if not recording_path:
            return {
                "success": True,
                "leadId": lead_id,
                "sessionId": session.id,
                "recording": None,
            }

        if not supabase:
            raise HTTPException(status_code=500, detail="Supabase client not initialized")

        signed_payload = supabase.storage.from_("client-docs").create_signed_url(recording_path, expires_in)
        signed_url = _extract_signed_url(signed_payload)
        if not signed_url:
            raise HTTPException(status_code=500, detail="Failed to generate signed recording URL")

        return {
            "success": True,
            "leadId": lead_id,
            "sessionId": session.id,
            "recording": {
                "path": recording_path,
                "url": signed_url,
                "expiresIn": expires_in,
            },
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching meeting recording: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{lead_id}/wrapup", response_model=Dict[str, Any])
async def lead_wrapup(
    lead_id: str,
    update_in: SessionUpdate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Submit post-call disposition and notes
    """
    try:
        session = _ensure_session_for_lead(db, lead_id)
        if not session:
             raise HTTPException(status_code=404, detail="Lead not found")
        
        # Update fields
        if update_in.disposition:
            session.disposition = update_in.disposition
            session.status = "completed"
            session.endTime = datetime.utcnow()
            
        if update_in.notes:
            session.notes = update_in.notes
        
        # Map other fields if present in schema
        if hasattr(update_in, "plan_name") and update_in.plan_name:
             session.planName = update_in.plan_name
        if hasattr(update_in, "premium") and update_in.premium:
             session.premium = update_in.premium

        # New Fields
        if update_in.call_summary: session.callSummary = update_in.call_summary
        if update_in.recording_link: session.recordingLink = update_in.recording_link
        if update_in.transcript_link: session.transcriptLink = update_in.transcript_link
        if update_in.citations_bundle_link: session.citationsBundleLink = update_in.citations_bundle_link
        if update_in.compliance_flags: session.complianceFlags = update_in.compliance_flags
        if update_in.action_items: session.actionItems = update_in.action_items
            
        db.commit()
        db.refresh(session)
        
        # Trigger GHL Sync
        background_tasks.add_task(sync_wrapup_to_ghl, lead_id)
        
        return {"success": True, "session": {"id": session.id, "status": session.status}}

    except Exception as e:
        db.rollback()
        print(f"Error in wrap-up: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{lead_id}/generate-summary", response_model=Dict[str, Any])
async def generate_summary(
    lead_id: str,
    db: Session = Depends(get_db)
):
    """
    Trigger AI summarization for the session
    """
    try:
        session = _ensure_session_for_lead(db, lead_id)
        if not session:
            raise HTTPException(status_code=404, detail="Lead not found")
             
        from app.services.meeting.summary_service import summary_service
        result = await summary_service.generate_call_summary(session.id)
        
        if not result:
            return {"success": False, "message": "Failed to generate summary or no transcripts found"}
            
        return {"success": True, "data": result}
        
    except Exception as e:
        print(f"Error generating summary: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{lead_id}/meeting-artifacts", response_model=Dict[str, Any])
async def get_meeting_artifacts(
    lead_id: str,
    db: Session = Depends(get_db)
):
    """
    Return persisted meeting artifacts for admin review/download:
    - customer transcriptions
    - AI responses
    - merged full chat
    - latest summary/compliance/action items
    """
    try:
        session = _ensure_session_for_lead(db, lead_id)
        if not session:
            raise HTTPException(status_code=404, detail="Lead not found")

        transcript_rows = (
            db.query(Transcript)
            .filter(Transcript.sessionId == session.id)
            .order_by(Transcript.timestamp.asc())
            .all()
        )

        transcriptions: List[Dict[str, Any]] = []
        ai_responses: List[Dict[str, Any]] = []
        full_chat: List[Dict[str, Any]] = []

        for row in transcript_rows:
            timestamp_iso = row.timestamp.isoformat() if row.timestamp else None
            item = {
                "id": row.id,
                "role": row.role,
                "content": row.content,
                "timestamp": timestamp_iso,
            }

            if row.role == "customer":
                transcriptions.append(item)
            elif row.role == "ai":
                ai_responses.append(item)

            full_chat.append(item)

        return {
            "success": True,
            "leadId": lead_id,
            "sessionId": session.id,
            "status": session.status,
            "disposition": session.disposition,
            "summary": {
                "callSummary": session.callSummary,
                "complianceFlags": session.complianceFlags,
                "actionItems": session.actionItems,
            },
            "transcriptions": transcriptions,
            "aiResponses": ai_responses,
            "fullChat": full_chat,
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching meeting artifacts: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{lead_id}/meeting-artifacts.csv")
async def download_meeting_artifacts_csv(
    lead_id: str,
    db: Session = Depends(get_db)
):
    """
    Download persisted meeting artifacts as CSV:
    summary + compliance + full chat timeline.
    """
    try:
        session = _ensure_session_for_lead(db, lead_id)
        if not session:
            raise HTTPException(status_code=404, detail="Lead not found")

        transcript_rows = (
            db.query(Transcript)
            .filter(Transcript.sessionId == session.id)
            .order_by(Transcript.timestamp.asc())
            .all()
        )

        compliance = session.complianceFlags if isinstance(session.complianceFlags, dict) else {}
        action_items = session.actionItems

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            "section",
            "timestamp",
            "role",
            "content",
            "call_summary",
            "action_items",
            "compliance_notes",
            "disclaimer_read",
            "forbidden_topics",
        ])

        writer.writerow([
            "summary",
            "",
            "ai",
            "",
            session.callSummary or "",
            json.dumps(action_items, ensure_ascii=False) if action_items is not None else "",
            compliance.get("notes", "") if isinstance(compliance, dict) else "",
            compliance.get("disclaimerRead", "") if isinstance(compliance, dict) else "",
            compliance.get("forbiddenTopics", "") if isinstance(compliance, dict) else "",
        ])

        for row in transcript_rows:
            writer.writerow([
                "chat",
                row.timestamp.isoformat() if row.timestamp else "",
                row.role,
                row.content,
                "",
                "",
                "",
                "",
                "",
            ])

        csv_content = output.getvalue()
        output.close()

        filename = f"meeting-artifacts-{lead_id}-{datetime.utcnow().strftime('%Y%m%d')}.csv"
        headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
        return Response(content=csv_content, media_type="text/csv", headers=headers)

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error downloading meeting artifacts CSV: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# =====================================================================
# EMPLOYER / GROUP LEAD ENDPOINTS
# =====================================================================

@router.post("/employer-intake", response_model=Dict[str, Any])
async def create_employer_lead(
    lead_in: EmployerLeadCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """
    Intake form for group/employer leads.
    Creates a lead with leadType='group' and pipeline starting at 'new_lead'.
    """
    try:
        lead_id = str(uuid.uuid4())

        renewal_date_parsed = None
        if lead_in.renewal_date:
            try:
                from datetime import date as date_type
                renewal_date_parsed = date_type.fromisoformat(lead_in.renewal_date)
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid renewalDate format. Use YYYY-MM-DD")

        db_lead = Lead(
            id=lead_id,
            leadType="group",
            pipelineStatus="new_lead",
            # Contact
            firstName=lead_in.first_name,
            lastName=lead_in.last_name,
            email=lead_in.email,
            phone=lead_in.phone,
            # Company
            companyName=lead_in.company_name,
            contactPerson=lead_in.contact_person,
            numEmployees=lead_in.num_employees,
            numEligible=lead_in.num_eligible,
            state=lead_in.state,
            industry=lead_in.industry,
            renewalDate=renewal_date_parsed,
            currentCarrier=lead_in.current_carrier,
            currentPlan=lead_in.current_plan,
            contributionStrategy=lead_in.contribution_strategy,
            benefitsNeeded=lead_in.benefits_needed,
            groupNotes=lead_in.group_notes,
            # Marketing
            utmSource=lead_in.utm_source,
            utmMedium=lead_in.utm_medium,
            utmCampaign=lead_in.utm_campaign,
            # Set productType for compatibility
            productType="group",
        )
        db.add(db_lead)
        db.flush()

        # Record initial pipeline entry
        history = PipelineHistory(
            id=str(uuid.uuid4()),
            leadId=lead_id,
            fromStage=None,
            toStage="new_lead",
        )
        db.add(history)

        db.commit()
        db.refresh(db_lead)

        # Notification
        from app.services.notification_service import notification_service
        contact_name = lead_in.contact_person or f"{lead_in.first_name or ''} {lead_in.last_name or ''}".strip()
        background_tasks.add_task(
            notification_service.create_notification,
            type="lead",
            title="New Group Lead",
            message=f"{lead_in.company_name} - {contact_name} ({lead_in.num_employees or '?'} employees)",
            metadata={"leadId": lead_id, "leadType": "group"},
        )

        return {
            "success": True,
            "leadId": lead_id,
            "leadType": "group",
            "companyName": lead_in.company_name,
        }

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"Error in employer lead intake: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{lead_id}/pipeline-history", response_model=List[Dict[str, Any]])
async def get_pipeline_history(
    lead_id: str,
    db: Session = Depends(get_db),
):
    """
    Get the full pipeline stage change history for a lead.
    """
    try:
        lead = db.query(Lead).filter(Lead.id == lead_id).first()
        if not lead:
            raise HTTPException(status_code=404, detail="Lead not found")

        history = (
            db.query(PipelineHistory)
            .filter(PipelineHistory.leadId == lead_id)
            .order_by(PipelineHistory.changedAt.asc())
            .all()
        )

        return [
            {
                "id": h.id,
                "leadId": h.leadId,
                "fromStage": h.fromStage,
                "toStage": h.toStage,
                "notes": h.notes,
                "changedAt": h.changedAt.isoformat() if h.changedAt else None,
            }
            for h in history
        ]

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching pipeline history: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
