from enum import Enum
from typing import Optional, Dict, Any
from pydantic import BaseModel, ConfigDict

class Status(str, Enum):
    NEW = "new"
    ACTIVE = "active"
    COMPLETED = "completed"

class Role(str, Enum):
    AGENT = "agent"
    CUSTOMER = "customer"
    AI = "ai"

class Disposition(str, Enum):
    BOOKED = "booked"
    QUOTED = "quoted"
    NI = "ni"
    FOLLOW_UP = "follow-up"

# Individual lead pipeline stages (original)
INDIVIDUAL_PIPELINE_STAGES = {"new", "appointment_booked", "quoted", "enrolled", "lost"}

# Group/employer lead pipeline stages (new)
GROUP_PIPELINE_STAGES = {
    "new_lead",
    "contacted",
    "discovery_scheduled",
    "census_requested",
    "census_received",
    "sent_to_warner",
    "quotes_received",
    "proposal_presented",
    "closed_won",
    "closed_lost",
    "renewal_followup",
}

# All valid pipeline stages
ALL_PIPELINE_STAGES = INDIVIDUAL_PIPELINE_STAGES | GROUP_PIPELINE_STAGES

class TimestampSchema(BaseModel):
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

    model_config = ConfigDict(populate_by_name=True)
