from typing import Optional
from pydantic import BaseModel, Field, ConfigDict
from app.schemas.common import Role, TimestampSchema

class TranscriptBase(BaseModel):
    session_id: str = Field(..., alias="sessionId")
    role: Role
    content: str
    timestamp: Optional[str] = None

class TranscriptCreate(TranscriptBase):
    pass

class Transcript(TranscriptBase, TimestampSchema):
    id: str

    model_config = ConfigDict(populate_by_name=True)
