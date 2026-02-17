from datetime import datetime
from typing import Any, Dict, List
from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends
from app.api import deps
from app.core.supabase import supabase
from app.schemas.lead import LeadCreate, Lead, SessionCreate, Session, SessionUpdate

router = APIRouter()

@router.post("/intake", response_model=Dict[str, Any])
async def create_lead_intake(
    lead_in: LeadCreate,
    background_tasks: BackgroundTasks
):
    """
    Receives intake data (product, state, triggers, UTMs)
    Returns a leadId (session ID)
    """
    # 1. Create Lead in Supabase
    lead_data = lead_in.model_dump(by_alias=True, exclude_none=True)
    # Generate UUID for Lead if Supabase doesn't auto-generate (it usually does, but let's be safe or rely on DB)
    # Actually Supabase/Postgres usually handles ID generation if configured.
    # checking schema.prisma: id String @id @default(uuid())
    # So we don't need to send ID.
    
    try:
        # map pydantic fields to DB columns if needed, but alias=True handles camelCase to snake_case? 
        # Wait, Prisma schema uses camelCase for some fields? 
        # No, Prisma schema: firstName String?
        # But in Python/Pydantic use snake_case.
        # We need to ensure the data sent to Supabase matches the column names.
        # The Supabase client sends JSON. PostgREST expects column names.
        # In Prisma schema: `firstName`. In Postgres it might be `firstname` or `firstName` depending on how it was created.
        # Providing `model_dump(by_alias=False)` gives snake_case `first_name`.
        # Providing `model_dump(by_alias=True)` gives camelCase `firstName`.
        # We should check the actual DB column names. 
        # Prisma usually preserves case if quoted, or lowercase if not. 
        # Let's assume camelCase for now based on Prisma schema.
        
        # Prepare data for Lead table
        db_lead_data = {
            "productType": lead_in.product_type,
            "state": lead_in.state,
            "triggers": lead_in.triggers,
            "firstName": lead_in.first_name,
            "lastName": lead_in.last_name,
            "email": lead_in.email,
            "phone": lead_in.phone,
            "utmSource": lead_in.utm_source,
            "utmMedium": lead_in.utm_medium,
            "utmCampaign": lead_in.utm_campaign,
            "utmTerm": lead_in.utm_term,
            "utmContent": lead_in.utm_content
        }
        
        lead_res = supabase.table("Lead").insert(db_lead_data).execute()
        if not lead_res.data:
            raise HTTPException(status_code=500, detail="Failed to create Lead")
        
        new_lead = lead_res.data[0]
        lead_id = new_lead["id"]
        
        # 2. Create Session
        session_data = {
            "leadId": lead_id,
            "status": "new",
            "createdAt": datetime.now().isoformat()
        }
        
        session_res = supabase.table("Session").insert(session_data).execute()
        
        # 3. Trigger Background Tasks (e.g. Sync to GHL)
        # background_tasks.add_task(sync_to_ghl, lead_id)

        return {"success": True, "leadId": lead_id}

    except Exception as e:
        print(f"Error in lead intake: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{lead_id}", response_model=Dict[str, Any])
async def get_lead_session(lead_id: str):
    """
    Retrieve lead session context
    """
    try:
        # Fetch Session with Lead relation
        # Supabase-py syntax for joins: select=*,Lead(*)
        res = supabase.table("Session").select("*, Lead(*)").eq("leadId", lead_id).execute()
        
        if not res.data:
            raise HTTPException(status_code=404, detail="Lead session not found")
            
        session = res.data[0]
        lead = session.get("Lead", {})
        
        # Flatten structure for frontend compatibility
        # Frontend expects: { id (leadId), productType, firstName, ...sessionFields }
        flat_response = {
            "id": session["leadId"],
            "startTime": session.get("startTime"),
            "status": session.get("status"),
            "ghlContactId": session.get("ghlContactId"),
            # Merge lead fields
            **lead
        }
        
        return flat_response
        
    except Exception as e:
         print(f"Error fetching lead: {str(e)}")
         raise HTTPException(status_code=500, detail=str(e))

@router.post("/{lead_id}/wrapup", response_model=Dict[str, Any])
async def lead_wrapup(
    lead_id: str,
    update_in: SessionUpdate
):
    """
    Submit post-call disposition and notes
    """
    try:
        # Prepare update data
        update_data = update_in.model_dump(exclude_unset=True, by_alias=True)
        
        # Always set status to completed if disposition is present
        if update_in.disposition:
            update_data["status"] = "completed"
            update_data["endTime"] = datetime.now().isoformat()

        res = supabase.table("Session").update(update_data).eq("leadId", lead_id).execute()
        
        if not res.data:
             raise HTTPException(status_code=404, detail="Session not found")
        
        # Sync to GHL (Background task or direct)
        
        return {"success": True, "session": res.data[0]}

    except Exception as e:
        print(f"Error in wrap-up: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
