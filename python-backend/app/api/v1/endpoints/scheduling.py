from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, Query, BackgroundTasks
from app.services.scheduling_service import scheduling_service
from app.services.notification_service import notification_service
from app.schemas.appointment import (
    AppointmentCreate,
    AppointmentUpdate,
    AvailabilitySettingsBulk,
)

router = APIRouter()


# ===================== AVAILABILITY =====================

@router.get("/availability")
async def get_availability(
    date_from: str = Query(..., alias="from", description="Start date YYYY-MM-DD"),
    date_to: str = Query(..., alias="to", description="End date YYYY-MM-DD"),
):
    """
    Get available time slots for a date range.
    Returns dates with their available booking slots.
    """
    try:
        slots = scheduling_service.get_available_slots(date_from, date_to)
        return slots
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/settings")
async def get_availability_settings():
    """Get the configured availability slots"""
    try:
        settings = scheduling_service.get_availability_settings()
        return settings
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/settings")
async def save_availability_settings(data: AvailabilitySettingsBulk):
    """Save availability settings (replaces all existing)"""
    try:
        slots_data = [
            {
                "dayOfWeek": s.day_of_week,
                "startTime": s.start_time,
                "endTime": s.end_time,
                "timezone": s.timezone,
                "slotDurationMinutes": s.slot_duration_minutes,
                "bufferMinutes": s.buffer_minutes,
                "isActive": s.is_active,
            }
            for s in data.slots
        ]
        result = scheduling_service.save_availability_settings(slots_data)
        return {"success": True, "slots": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ===================== APPOINTMENTS =====================

@router.post("/appointments")
async def create_appointment(
    data: AppointmentCreate,
    background_tasks: BackgroundTasks,
):
    """
    Book a new appointment.
    Creates the appointment, generates an internal meeting link,
    and triggers confirmation notification.
    """
    try:
        appointment_data = {
            "leadId": data.lead_id,
            "date": data.date,
            "startTime": data.start_time,
            "timezone": data.timezone,
            "durationMinutes": data.duration_minutes,
            "serviceName": data.service_name,
            "notes": data.notes,
        }

        result = scheduling_service.create_appointment(appointment_data)

        # Create notification for admin
        background_tasks.add_task(
            notification_service.create_notification,
            type="booking",
            title="New Appointment Booked",
            message=f"{result.get('customerName', 'A prospect')} booked on {result['date']} at {result['startTime']}",
            metadata={
                "appointmentId": result["id"],
                "leadId": result["leadId"],
                "meetingLink": result.get("meetingLink"),
            }
        )

        return {
            "success": True,
            "appointment": result,
            "meetingLink": result.get("meetingLink"),
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/appointments")
async def get_appointments(
    status: Optional[str] = Query(None, description="Filter by status"),
    date_from: Optional[str] = Query(None, alias="from", description="From date YYYY-MM-DD"),
    date_to: Optional[str] = Query(None, alias="to", description="To date YYYY-MM-DD"),
    limit: int = Query(100, le=500),
):
    """Get appointments with optional filters"""
    try:
        appointments = scheduling_service.get_appointments(
            status=status,
            date_from=date_from,
            date_to=date_to,
            limit=limit,
        )
        return appointments
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/appointments/{appointment_id}")
async def get_appointment(appointment_id: str):
    """Get a specific appointment by ID"""
    try:
        result = scheduling_service.get_appointment_by_id(appointment_id)
        if not result:
            raise HTTPException(status_code=404, detail="Appointment not found")
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/appointments/{appointment_id}")
async def update_appointment(appointment_id: str, data: AppointmentUpdate):
    """Update appointment status or details"""
    try:
        update_data = {}
        if data.status is not None:
            update_data["status"] = data.status
        if data.notes is not None:
            update_data["notes"] = data.notes
        if data.date is not None:
            update_data["date"] = data.date
        if data.start_time is not None:
            update_data["startTime"] = data.start_time

        result = scheduling_service.update_appointment(appointment_id, update_data)
        if not result:
            raise HTTPException(status_code=404, detail="Appointment not found")
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/appointments/{appointment_id}")
async def cancel_appointment(appointment_id: str):
    """Cancel an appointment"""
    try:
        success = scheduling_service.cancel_appointment(appointment_id)
        if not success:
            raise HTTPException(status_code=404, detail="Appointment not found")
        return {"success": True, "message": "Appointment cancelled"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ===================== PUBLIC MANAGE (Token-Based) =====================

@router.get("/manage/{token}")
async def get_appointment_by_token(token: str):
    """Public: Get appointment details using manage token (for email links)"""
    try:
        result = scheduling_service.get_appointment_by_token(token)
        if not result:
            raise HTTPException(status_code=404, detail="Appointment not found or link expired")
        # Strip sensitive fields for public response
        safe_result = {k: v for k, v in result.items() if k != "manageToken"}
        return safe_result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


from pydantic import BaseModel as PydanticBaseModel

class RescheduleRequest(PydanticBaseModel):
    date: str
    startTime: str
    timezone: str = None


@router.post("/manage/{token}/cancel")
async def cancel_by_token(token: str, background_tasks: BackgroundTasks):
    """Public: Cancel an appointment using manage token"""
    try:
        result = scheduling_service.cancel_by_token(token)
        if not result:
            raise HTTPException(status_code=404, detail="Appointment not found or link expired")

        # Notify admin
        background_tasks.add_task(
            notification_service.create_notification,
            type="booking",
            title="Appointment Cancelled",
            message=f"{result.get('customerName', 'A client')} cancelled {result.get('bookingRef', '')} on {result['date']}",
            metadata={"appointmentId": result["id"], "bookingRef": result.get("bookingRef")}
        )

        return {"success": True, "appointment": result}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/manage/{token}/reschedule")
async def reschedule_by_token(token: str, data: RescheduleRequest, background_tasks: BackgroundTasks):
    """Public: Reschedule an appointment using manage token"""
    try:
        result = scheduling_service.reschedule_by_token(
            token=token,
            new_date=data.date,
            new_start_time=data.startTime,
            new_timezone=data.timezone,
        )
        if not result:
            raise HTTPException(status_code=404, detail="Appointment not found or link expired")

        # Notify admin
        background_tasks.add_task(
            notification_service.create_notification,
            type="booking",
            title="Appointment Rescheduled",
            message=f"{result.get('customerName', 'A client')} rescheduled {result.get('bookingRef', '')} to {result['date']} at {result['startTime']}",
            metadata={"appointmentId": result["id"], "bookingRef": result.get("bookingRef")}
        )

        return {"success": True, "appointment": result}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
