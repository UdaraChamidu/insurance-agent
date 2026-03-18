from typing import Optional, Dict, Any, List
from pydantic import BaseModel, EmailStr, Field, ConfigDict
from app.schemas.common import Status, Disposition, TimestampSchema

# --- LEAD SCHEMAS ---

class LeadBase(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    product_type: Optional[str] = Field(None, alias="productType")
    state: Optional[str] = None
    triggers: Optional[List[str]] = None
    first_name: Optional[str] = Field(None, alias="firstName")
    last_name: Optional[str] = Field(None, alias="lastName")
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    utm_source: Optional[str] = Field(None, alias="utmSource")
    utm_medium: Optional[str] = Field(None, alias="utmMedium")
    utm_campaign: Optional[str] = Field(None, alias="utmCampaign")
    utm_term: Optional[str] = Field(None, alias="utmTerm")
    utm_content: Optional[str] = Field(None, alias="utmContent")

class LeadCreate(LeadBase):
    pass

class LeadUpdate(LeadBase):
    pass

class Lead(LeadBase, TimestampSchema):
    id: str

    model_config = ConfigDict(populate_by_name=True)


# --- EMPLOYER / GROUP LEAD SCHEMAS ---

class EmployerLeadCreate(BaseModel):
    """Intake form for group/employer leads."""
    model_config = ConfigDict(populate_by_name=True)

    # Contact person
    first_name: Optional[str] = Field(None, alias="firstName")
    last_name: Optional[str] = Field(None, alias="lastName")
    email: Optional[EmailStr] = None
    phone: Optional[str] = None

    # Company details
    company_name: str = Field(..., alias="companyName")
    contact_person: Optional[str] = Field(None, alias="contactPerson")
    num_employees: Optional[int] = Field(None, alias="numEmployees")
    num_eligible: Optional[int] = Field(None, alias="numEligible")
    state: Optional[str] = None
    industry: Optional[str] = None
    renewal_date: Optional[str] = Field(None, alias="renewalDate")  # YYYY-MM-DD
    current_carrier: Optional[str] = Field(None, alias="currentCarrier")
    current_plan: Optional[str] = Field(None, alias="currentPlan")
    contribution_strategy: Optional[str] = Field(None, alias="contributionStrategy")
    benefits_needed: Optional[List[str]] = Field(None, alias="benefitsNeeded")
    group_notes: Optional[str] = Field(None, alias="groupNotes")

    # Marketing
    utm_source: Optional[str] = Field(None, alias="utmSource")
    utm_medium: Optional[str] = Field(None, alias="utmMedium")
    utm_campaign: Optional[str] = Field(None, alias="utmCampaign")


# --- PIPELINE HISTORY SCHEMA ---

class PipelineHistoryEntry(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str
    lead_id: str = Field(..., alias="leadId")
    from_stage: Optional[str] = Field(None, alias="fromStage")
    to_stage: str = Field(..., alias="toStage")
    notes: Optional[str] = None
    changed_at: Optional[str] = Field(None, alias="changedAt")

# --- SESSION SCHEMAS ---

class SessionBase(BaseModel):
    lead_id: str = Field(..., alias="leadId")
    status: Status = Status.NEW
    start_time: Optional[str] = Field(None, alias="startTime")
    end_time: Optional[str] = Field(None, alias="endTime")
    disposition: Optional[Disposition] = None
    notes: Optional[str] = None
    plan_name: Optional[str] = Field(None, alias="planName")
    premium: Optional[str] = None
    ghl_contact_id: Optional[str] = Field(None, alias="ghlContactId")

class SessionCreate(SessionBase):
    pass

class SessionUpdate(BaseModel):
    status: Optional[Status] = None
    start_time: Optional[str] = Field(None, alias="startTime")
    end_time: Optional[str] = Field(None, alias="endTime")
    disposition: Optional[Disposition] = None
    notes: Optional[str] = None
    plan_name: Optional[str] = Field(None, alias="planName")
    premium: Optional[str] = None
    ghl_contact_id: Optional[str] = Field(None, alias="ghlContactId")
    
    # New Fields
    call_summary: Optional[str] = Field(None, alias="callSummary")
    recording_link: Optional[str] = Field(None, alias="recordingLink")
    transcript_link: Optional[str] = Field(None, alias="transcriptLink")
    citations_bundle_link: Optional[str] = Field(None, alias="citationsBundleLink")
    compliance_flags: Optional[Dict[str, Any]] = Field(None, alias="complianceFlags")
    action_items: Optional[Any] = Field(None, alias="actionItems")

class Session(SessionBase, TimestampSchema):
    id: str
    lead: Optional[Lead] = None

    model_config = ConfigDict(populate_by_name=True)
