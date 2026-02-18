from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime


# --- APPOINTMENT SCHEMAS ---

class AppointmentCreate(BaseModel):
    lead_id: str = Field(..., alias="leadId")
    date: str  # YYYY-MM-DD
    start_time: str = Field(..., alias="startTime")  # HH:MM
    timezone: str = "America/New_York"
    duration_minutes: int = Field(30, alias="durationMinutes")
    service_name: str = Field("Insurance Consultation", alias="serviceName")
    notes: Optional[str] = None

    model_config = ConfigDict(populate_by_name=True)


class AppointmentUpdate(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None
    date: Optional[str] = None
    start_time: Optional[str] = Field(None, alias="startTime")
    timezone: Optional[str] = None

    model_config = ConfigDict(populate_by_name=True)


class AppointmentResponse(BaseModel):
    id: str
    lead_id: str = Field(alias="leadId")
    date: str
    start_time: str = Field(alias="startTime")
    end_time: str = Field(alias="endTime")
    timezone: str
    duration_minutes: int = Field(alias="durationMinutes")
    meeting_link: Optional[str] = Field(None, alias="meetingLink")
    meeting_id: Optional[str] = Field(None, alias="meetingId")
    status: str
    service_name: str = Field(alias="serviceName")
    notes: Optional[str] = None
    confirmation_sent_at: Optional[str] = Field(None, alias="confirmationSentAt")
    reminder_sent_at: Optional[str] = Field(None, alias="reminderSentAt")
    created_at: Optional[str] = Field(None, alias="createdAt")
    # Flattened lead info
    customer_name: Optional[str] = Field(None, alias="customerName")
    customer_email: Optional[str] = Field(None, alias="customerEmail")
    customer_phone: Optional[str] = Field(None, alias="customerPhone")

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)


# --- AVAILABILITY SCHEMAS ---

class AvailabilitySlotCreate(BaseModel):
    day_of_week: int = Field(..., alias="dayOfWeek")  # 0=Mon..6=Sun
    start_time: str = Field(..., alias="startTime")    # HH:MM
    end_time: str = Field(..., alias="endTime")        # HH:MM
    timezone: str = "America/New_York"
    slot_duration_minutes: int = Field(30, alias="slotDurationMinutes")
    buffer_minutes: int = Field(10, alias="bufferMinutes")
    is_active: bool = Field(True, alias="isActive")

    model_config = ConfigDict(populate_by_name=True)


class AvailabilitySlotResponse(BaseModel):
    id: str
    day_of_week: int = Field(alias="dayOfWeek")
    start_time: str = Field(alias="startTime")
    end_time: str = Field(alias="endTime")
    timezone: str
    slot_duration_minutes: int = Field(alias="slotDurationMinutes")
    buffer_minutes: int = Field(alias="bufferMinutes")
    is_active: bool = Field(alias="isActive")

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)


class AvailableTimeSlot(BaseModel):
    date: str
    start_time: str = Field(alias="startTime")
    end_time: str = Field(alias="endTime")
    available: bool = True

    model_config = ConfigDict(populate_by_name=True)


class AvailabilityResponse(BaseModel):
    date: str
    slots: List[AvailableTimeSlot]

    model_config = ConfigDict(populate_by_name=True)


class AvailabilitySettingsBulk(BaseModel):
    """For saving all availability settings at once"""
    slots: List[AvailabilitySlotCreate]
