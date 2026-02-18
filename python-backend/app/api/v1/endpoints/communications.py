from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import Optional
from app.services.communication_service import communication_service
from app.services.scheduling_service import scheduling_service

router = APIRouter()


class SendConfirmationRequest(BaseModel):
    appointmentId: str


class SendReminderRequest(BaseModel):
    appointmentId: str


@router.post("/booking-confirmation")
async def send_booking_confirmation(data: SendConfirmationRequest):
    """Send booking confirmation email + SMS for an appointment"""
    try:
        appointment = scheduling_service.get_appointment_by_id(data.appointmentId)
        if not appointment:
            raise HTTPException(status_code=404, detail="Appointment not found")

        results = communication_service.send_booking_confirmation(appointment)
        return {
            "success": True,
            "results": results,
            "appointmentId": data.appointmentId,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/booking-reminder")
async def send_booking_reminder(data: SendReminderRequest):
    """Send booking reminder email + SMS"""
    try:
        appointment = scheduling_service.get_appointment_by_id(data.appointmentId)
        if not appointment:
            raise HTTPException(status_code=404, detail="Appointment not found")

        results = communication_service.send_booking_reminder(appointment)
        return {
            "success": True,
            "results": results,
            "appointmentId": data.appointmentId,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/cancellation")
async def send_cancellation_notice(data: SendConfirmationRequest):
    """Send cancellation notification"""
    try:
        appointment = scheduling_service.get_appointment_by_id(data.appointmentId)
        if not appointment:
            raise HTTPException(status_code=404, detail="Appointment not found")

        results = communication_service.send_cancellation_notice(appointment)
        return {
            "success": True,
            "results": results,
            "appointmentId": data.appointmentId,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
