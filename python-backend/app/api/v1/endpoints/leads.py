import uuid
from datetime import datetime
from typing import Any, Dict, List
from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db, SessionLocal
from app.models import Lead, Session as DbSession
from app.schemas.lead import LeadCreate, Lead as LeadSchema, SessionCreate, SessionUpdate
from app.services.integrations.ghl import ghl_service

router = APIRouter()

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
        # data = db.query(Lead).offset(skip).limit(limit).all()
        # Better: Join with Session to get status
        results = (
            db.query(Lead, DbSession)
            .outerjoin(DbSession, Lead.id == DbSession.leadId)
            .order_by(DbSession.createdAt.desc()) # Newest first
            .offset(skip)
            .limit(limit)
            .all()
        )
        
        leads_list = []
        for lead, session in results:
            leads_list.append({
                "id": lead.id,
                "firstName": lead.firstName,
                "lastName": lead.lastName,
                "email": lead.email,
                "phone": lead.phone,
                "productType": lead.productType,
                "state": lead.state,
                "createdAt": session.createdAt if session else None,
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
        # Fetch Session with Lead relation
        session = db.query(DbSession).filter(DbSession.leadId == lead_id).first()
        
        if not session:
             raise HTTPException(status_code=404, detail="Lead session not found")
            
        lead = session.lead
        
        # Flatten structure for frontend compatibility
        flat_response = {
            "id": session.leadId,
            "startTime": session.startTime,
            "status": session.status,
            "ghlContactId": session.ghlContactId,
            # Merge lead fields
            "productType": lead.productType,
            "state": lead.state,
            "firstName": lead.firstName,
            "lastName": lead.lastName,
            "email": lead.email,
            "phone": lead.phone
        }
        
        return flat_response
        
    except HTTPException:
        raise
    except Exception as e:
         print(f"Error fetching lead: {str(e)}")
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
        session = db.query(DbSession).filter(DbSession.leadId == lead_id).first()
        if not session:
             raise HTTPException(status_code=404, detail="Session not found")
        
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
        session = db.query(DbSession).filter(DbSession.leadId == lead_id).first()
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
            
        from app.services.meeting.summary_service import summary_service
        result = await summary_service.generate_call_summary(session.id)
        
        if not result:
            return {"success": False, "message": "Failed to generate summary or no transcripts found"}
            
        return {"success": True, "data": result}
        
    except Exception as e:
        print(f"Error generating summary: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
