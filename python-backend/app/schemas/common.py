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

class TimestampSchema(BaseModel):
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    
    model_config = ConfigDict(populate_by_name=True)
