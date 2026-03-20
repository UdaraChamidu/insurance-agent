from sqlalchemy import Column, String, DateTime, ForeignKey, Text, JSON, Boolean, Integer, Date
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
from app.core.database import Base

class Lead(Base):
    __tablename__ = "Lead"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    createdAt = Column(DateTime, default=datetime.utcnow)
    updatedAt = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Lead type: "individual" (original ACA flow) or "group" (employer/group flow)
    leadType = Column(String, default="individual")

    # Intake Fields (individual)
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

    # Pipeline status
    # Individual: new, appointment_booked, quoted, enrolled, lost
    # Group: new_lead, contacted, discovery_scheduled, census_requested,
    #        census_received, sent_to_warner, quotes_received,
    #        proposal_presented, closed_won, closed_lost, renewal_followup
    pipelineStatus = Column(String, default="new")

    # --- Employer / Group Fields ---
    companyName = Column(String, nullable=True)
    contactPerson = Column(String, nullable=True)
    numEmployees = Column(Integer, nullable=True)
    numEligible = Column(Integer, nullable=True)
    industry = Column(String, nullable=True)
    renewalDate = Column(Date, nullable=True)
    currentCarrier = Column(String, nullable=True)
    currentPlan = Column(String, nullable=True)
    contributionStrategy = Column(String, nullable=True)
    benefitsNeeded = Column(JSON, nullable=True)  # e.g. ["medical","dental","vision"]
    groupNotes = Column(Text, nullable=True)

    # Secure upload token for public file collection portal
    uploadToken = Column(String, unique=True, nullable=True, index=True)

    # Relation to Session
    session = relationship("Session", uselist=False, back_populates="lead")
    appointments = relationship("Appointment", back_populates="lead")
    documents = relationship("Document", back_populates="lead")
    pipelineHistory = relationship("PipelineHistory", back_populates="lead", order_by="PipelineHistory.changedAt")

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
    
    # New Fields for Structured Wrap-Up / AI Summary
    callSummary = Column(Text, nullable=True)
    recordingLink = Column(String, nullable=True)
    transcriptLink = Column(String, nullable=True)
    citationsBundleLink = Column(String, nullable=True)
    complianceFlags = Column(JSON, nullable=True)
    actionItems = Column(JSON, nullable=True)

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


class Appointment(Base):                           
    __tablename__ = "Appointment"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    createdAt = Column(DateTime, default=datetime.utcnow)
    updatedAt = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Human-readable booking reference (EDB-001, EDB-002, ...)
    bookingRef = Column(String, unique=True, nullable=True, index=True)
    # Secure token for manage links (cancel/reschedule via email)
    manageToken = Column(String, unique=True, nullable=True, index=True)

    leadId = Column(String, ForeignKey("Lead.id"), nullable=False)

    # Scheduling
    date = Column(String, nullable=False)          # YYYY-MM-DD
    startTime = Column(String, nullable=False)     # HH:MM (24h)
    endTime = Column(String, nullable=False)       # HH:MM (24h)
    timezone = Column(String, default="America/New_York")
    durationMinutes = Column(Integer, default=30)

    # Meeting Link (internal WebRTC)
    meetingLink = Column(String, nullable=True)
    meetingId = Column(String, nullable=True)

    # Status: pending, confirmed, cancelled, completed, no_show
    status = Column(String, default="confirmed")

    # Communication tracking
    confirmationSentAt = Column(DateTime, nullable=True)
    reminderSentAt = Column(DateTime, nullable=True)

    notes = Column(Text, nullable=True)
    serviceName = Column(String, default="Insurance Consultation")

    # Relationships
    lead = relationship("Lead", back_populates="appointments")


class AvailabilitySlot(Base):
    __tablename__ = "AvailabilitySlot"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    createdAt = Column(DateTime, default=datetime.utcnow)

    dayOfWeek = Column(Integer, nullable=False)      # 0=Mon, 1=Tue, ..., 6=Sun
    startTime = Column(String, nullable=False)       # HH:MM (24h)
    endTime = Column(String, nullable=False)         # HH:MM (24h)
    timezone = Column(String, default="America/New_York")
    slotDurationMinutes = Column(Integer, default=30)
    bufferMinutes = Column(Integer, default=10)
    isActive = Column(Boolean, default=True)

                        
class Document(Base):
    __tablename__ = "Document"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    createdAt = Column(DateTime, default=datetime.utcnow)
    
    leadId = Column(String, ForeignKey("Lead.id"), nullable=False)
    
    filename = Column(String, nullable=False)
    filePath = Column(String, nullable=False) # Storage path
    fileType = Column(String, nullable=True)
    fileSize = Column(Integer, default=0)
    
    description = Column(String, nullable=True) # Notes from user
    folderCategory = Column(String, nullable=True)  # Prospecting, Active Quotes, Sold Groups, Renewals, Compliance-Docs

    lead = relationship("Lead", back_populates="documents")


class PipelineHistory(Base):
    __tablename__ = "PipelineHistory"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    changedAt = Column(DateTime, default=datetime.utcnow)

    leadId = Column(String, ForeignKey("Lead.id"), nullable=False)
    fromStage = Column(String, nullable=True)
    toStage = Column(String, nullable=False)
    notes = Column(Text, nullable=True)

    lead = relationship("Lead", back_populates="pipelineHistory")


class MessageTemplate(Base):
    __tablename__ = "MessageTemplate"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    createdAt = Column(DateTime, default=datetime.utcnow)
    updatedAt = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    name = Column(String, nullable=False, unique=True)
    type = Column(String, nullable=False)  # "email" or "sms"
    subject = Column(String, nullable=True)  # email subject line (null for SMS)
    body = Column(Text, nullable=False)
    variables = Column(JSON, nullable=True)  # e.g. ["company_name", "contact_name"]
    triggerStage = Column(String, nullable=True)  # pipeline stage that triggers this template
    isActive = Column(Boolean, default=True)
