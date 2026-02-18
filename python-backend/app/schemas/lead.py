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

class Session(SessionBase, TimestampSchema):
    id: str
    lead: Optional[Lead] = None

    model_config = ConfigDict(populate_by_name=True)
