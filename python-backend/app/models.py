from sqlalchemy import Column, String, DateTime, ForeignKey, Text, JSON, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
from app.core.database import Base

class Lead(Base):
    __tablename__ = "Lead"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    createdAt = Column(DateTime, default=datetime.utcnow)
    updatedAt = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Intake Fields
    productType = Column(String, nullable=True)
    state = Column(String, nullable=True)
    triggers = Column(JSON, nullable=True)
    
    # Contact Info
    firstName = Column(String, nullable=True)
    lastName = Column(String, nullable=True)
    email = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    
    # Marketing
    utmSource = Column(String, nullable=True)
    utmMedium = Column(String, nullable=True)
    utmCampaign = Column(String, nullable=True)
    utmTerm = Column(String, nullable=True)
    utmContent = Column(String, nullable=True)
    
    # Relation to Session
    session = relationship("Session", uselist=False, back_populates="lead")

class Session(Base):
    __tablename__ = "Session"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    createdAt = Column(DateTime, default=datetime.utcnow)
    updatedAt = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    leadId = Column(String, ForeignKey("Lead.id"), unique=True, nullable=False)
    
    status = Column(String, default="new")
    startTime = Column(DateTime, nullable=True)
    endTime = Column(DateTime, nullable=True)
    
    disposition = Column(String, nullable=True)
    notes = Column(String, nullable=True)
    planName = Column(String, nullable=True)
    premium = Column(String, nullable=True)
    
    ghlContactId = Column(String, nullable=True)
    
    lead = relationship("Lead", back_populates="session")
    transcripts = relationship("Transcript", back_populates="session")

class Transcript(Base):
    __tablename__ = "Transcript"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    createdAt = Column(DateTime, default=datetime.utcnow)
    
    sessionId = Column(String, ForeignKey("Session.id"), nullable=False)
    role = Column(String, nullable=False) # agent, customer, ai
    content = Column(Text, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)
    
    session = relationship("Session", back_populates="transcripts")

class Notification(Base):
    __tablename__ = "Notification"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    createdAt = Column(DateTime, default=datetime.utcnow)
    
    type = Column(String, nullable=False) # file, booking, lead, info
    title = Column(String, nullable=False)
    message = Column(String, nullable=False)
    isRead = Column(Boolean, default=False)
    
    metadata_json = Column(JSON, nullable=True)

