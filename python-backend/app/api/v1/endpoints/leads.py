import uuid
from datetime import datetime
from typing import Any, Dict, List
from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models import Lead, Session as DbSession
from app.schemas.lead import LeadCreate, Lead as LeadSchema, SessionCreate, SessionUpdate

router = APIRouter()

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
        # Flush to check for errors before committing (optional, but good for catching dupes)
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
        
        # 3. Trigger Background Tasks (e.g. Sync to GHL)
        # background_tasks.add_task(sync_to_ghl, lead_id)

        return {"success": True, "leadId": lead_id}

    except Exception as e:
        db.rollback()
        print(f"Error in lead intake: {str(e)}")
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
        # We need to query by leadId which is on the Session model
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
            
        # If schema has more fields, map them here
            
        db.commit()
        db.refresh(session)
        
        return {"success": True, "session": {"id": session.id, "status": session.status}}

    except Exception as e:
        db.rollback()
        print(f"Error in wrap-up: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
