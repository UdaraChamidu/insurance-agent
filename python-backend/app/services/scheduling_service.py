import logging
import uuid
import secrets
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.core.database import SessionLocal
from app.core.database import SessionLocal
from app.models import Appointment, AvailabilitySlot, Lead
# Import communication_service properly (lazy or top-level if safe).
# communication_service imports EmailService and TwilioService.
# It does NOT import SchedulingService. So top-level import is safe.
from app.services.communication_service import communication_service

logger = logging.getLogger(__name__)


class SchedulingService:
    """
    Custom scheduling engine that replaces Microsoft Bookings.
    Manages availability slots, computes open time slots, and creates
    appointments with internal WebRTC meeting links.
    """

    def get_availability_settings(self) -> List[Dict[str, Any]]:
        """Get all configured availability slots"""
        db = SessionLocal()
        try:
            slots = db.query(AvailabilitySlot).order_by(
                AvailabilitySlot.dayOfWeek,
                AvailabilitySlot.startTime
            ).all()
            return [self._map_availability_slot(s) for s in slots]
        finally:
            db.close()

    def save_availability_settings(self, slots_data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Save availability settings (replace all existing)"""
        db = SessionLocal()
        try:
            # Clear existing
            db.query(AvailabilitySlot).delete()

            new_slots = []
            for slot_data in slots_data:
                slot = AvailabilitySlot(
                    id=str(uuid.uuid4()),
                    dayOfWeek=slot_data["dayOfWeek"],
                    startTime=slot_data["startTime"],
                    endTime=slot_data["endTime"],
                    timezone=slot_data.get("timezone", "America/New_York"),
                    slotDurationMinutes=slot_data.get("slotDurationMinutes", 30),
                    bufferMinutes=slot_data.get("bufferMinutes", 10),
                    isActive=slot_data.get("isActive", True),
                )
                db.add(slot)
                new_slots.append(slot)

            db.commit()
            for s in new_slots:
                db.refresh(s)

            return [self._map_availability_slot(s) for s in new_slots]
        except Exception as e:
            db.rollback()
            logger.error(f"Error saving availability settings: {e}")
            raise
        finally:
            db.close()

    def get_available_slots(self, date_from: str, date_to: str) -> List[Dict[str, Any]]:
        """
        Compute available time slots for a date range.
        Cross-references AvailabilitySlot config against existing Appointments.
        """
        db = SessionLocal()
        try:
            # Get all active availability slots
            avail_slots = db.query(AvailabilitySlot).filter(
                AvailabilitySlot.isActive == True
            ).all()

            if not avail_slots:
                # Return default availability if none configured (Mon-Fri 9-5)
                avail_slots = self._get_default_availability()

            # Get existing appointments in range
            existing_appointments = db.query(Appointment).filter(
                Appointment.date >= date_from,
                Appointment.date <= date_to,
                Appointment.status.in_(["confirmed", "pending"])
            ).all()

            # Build a set of booked slots for quick lookup
            booked = set()
            for apt in existing_appointments:
                booked.add(f"{apt.date}_{apt.startTime}")

            # Generate available slots for each date
            from_date = datetime.strptime(date_from, "%Y-%m-%d")
            to_date = datetime.strptime(date_to, "%Y-%m-%d")

            results = []
            current = from_date
            while current <= to_date:
                day_of_week = current.weekday()  # 0=Mon, 6=Sun
                date_str = current.strftime("%Y-%m-%d")

                # Find matching availability slots for this day
                day_slots = [s for s in avail_slots if (
                    s.dayOfWeek == day_of_week if isinstance(s, AvailabilitySlot) 
                    else s["dayOfWeek"] == day_of_week
                )]

                day_available = []
                for slot in day_slots:
                    if isinstance(slot, AvailabilitySlot):
                        start_h, start_m = map(int, slot.startTime.split(":"))
                        end_h, end_m = map(int, slot.endTime.split(":"))
                        duration = slot.slotDurationMinutes
                        buffer = slot.bufferMinutes
                    else:
                        start_h, start_m = map(int, slot["startTime"].split(":"))
                        end_h, end_m = map(int, slot["endTime"].split(":"))
                        duration = slot.get("slotDurationMinutes", 30)
                        buffer = slot.get("bufferMinutes", 10)

                    # Generate individual time slots
                    slot_start = datetime(current.year, current.month, current.day, start_h, start_m)
                    slot_end_boundary = datetime(current.year, current.month, current.day, end_h, end_m)

                    while slot_start + timedelta(minutes=duration) <= slot_end_boundary:
                        slot_end = slot_start + timedelta(minutes=duration)
                        start_str = slot_start.strftime("%H:%M")
                        end_str = slot_end.strftime("%H:%M")

                        is_booked = f"{date_str}_{start_str}" in booked
                        # Don't show past slots
                        is_past = datetime.combine(current.date(), slot_start.time()) < datetime.utcnow()

                        if not is_booked and not is_past:
                            day_available.append({
                                "startTime": start_str,
                                "endTime": end_str,
                                "available": True
                            })

                        slot_start = slot_end + timedelta(minutes=buffer)

                if day_available:
                    results.append({
                        "date": date_str,
                        "slots": day_available
                    })

                current += timedelta(days=1)

            return results
        finally:
            db.close()

    def create_appointment(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Create a new appointment:
        1. Validate the slot is available
        2. Generate internal WebRTC meeting link
        3. Save to DB
        4. Update lead pipeline status
        """
        db = SessionLocal()
        try:
            lead_id = data["leadId"]
            date = data["date"]
            start_time = data["startTime"]
            timezone = data.get("timezone", "America/New_York")
            duration = data.get("durationMinutes", 30)

            # Validate lead exists
            lead = db.query(Lead).filter(Lead.id == lead_id).first()
            if not lead:
                raise ValueError(f"Lead {lead_id} not found")

            # Check if slot is already booked
            existing = db.query(Appointment).filter(
                Appointment.date == date,
                Appointment.startTime == start_time,
                Appointment.status.in_(["confirmed", "pending"])
            ).first()

            if existing:
                raise ValueError("This time slot is already booked")

            # Calculate end time
            start_h, start_m = map(int, start_time.split(":"))
            start_dt = datetime(2000, 1, 1, start_h, start_m)
            end_dt = start_dt + timedelta(minutes=duration)
            end_time = end_dt.strftime("%H:%M")

            # Generate internal meeting link (client-facing)
            meeting_id = str(uuid.uuid4())
            meeting_link = f"/meeting?meetingId={meeting_id}&role=client"

            # Generate booking reference and manage token
            booking_ref = self._generate_booking_ref(db)
            manage_token = secrets.token_urlsafe(32)

            # Create appointment
            appointment = Appointment(
                id=str(uuid.uuid4()),
                bookingRef=booking_ref,
                manageToken=manage_token,
                leadId=lead_id,
                date=date,
                startTime=start_time,
                endTime=end_time,
                timezone=timezone,
                durationMinutes=duration,
                meetingLink=meeting_link,
                meetingId=meeting_id,
                status="confirmed",
                serviceName=data.get("serviceName", "Insurance Consultation"),
                notes=data.get("notes"),
            )

            db.add(appointment)

            # Update lead pipeline status
            lead.pipelineStatus = "appointment_booked"
            lead.updatedAt = datetime.utcnow()

            db.commit()
            db.refresh(appointment)
            db.refresh(lead)

            result = self._map_appointment(appointment, lead)
            
            # Send SMS/Email confirmation (Backend side)
            try:
                communication_service.send_booking_confirmation(result)
            except Exception as comm_err:
                logger.error(f"Failed to send confirmation SMS/Email: {comm_err}")

            return result

        except Exception as e:
            db.rollback()
            logger.error(f"Error creating appointment: {e}")
            raise
        finally:
            db.close()

    def get_appointments(
        self,
        status: Optional[str] = None,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """Get appointments with optional filters"""
        db = SessionLocal()
        try:
            query = db.query(Appointment).join(Lead)

            if status:
                query = query.filter(Appointment.status == status)
            if date_from:
                query = query.filter(Appointment.date >= date_from)
            if date_to:
                query = query.filter(Appointment.date <= date_to)

            appointments = query.order_by(
                Appointment.date.desc(),
                Appointment.startTime.desc()
            ).limit(limit).all()

            return [self._map_appointment(apt, apt.lead) for apt in appointments]
        finally:
            db.close()

    def get_appointment_by_id(self, appointment_id: str) -> Optional[Dict[str, Any]]:
        """Get a single appointment by ID"""
        db = SessionLocal()
        try:
            apt = db.query(Appointment).filter(Appointment.id == appointment_id).first()
            if not apt:
                return None
            return self._map_appointment(apt, apt.lead)
        finally:
            db.close()

    def update_appointment(self, appointment_id: str, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Update appointment fields"""
        db = SessionLocal()
        try:
            apt = db.query(Appointment).filter(Appointment.id == appointment_id).first()
            if not apt:
                return None

            if "status" in data and data["status"]:
                apt.status = data["status"]
            if "notes" in data and data["notes"] is not None:
                apt.notes = data["notes"]
            if "date" in data and data["date"]:
                apt.date = data["date"]
            if "startTime" in data and data["startTime"]:
                apt.startTime = data["startTime"]
                # Recalculate end time
                start_h, start_m = map(int, data["startTime"].split(":"))
                start_dt = datetime(2000, 1, 1, start_h, start_m)
                end_dt = start_dt + timedelta(minutes=apt.durationMinutes)
                apt.endTime = end_dt.strftime("%H:%M")

            apt.updatedAt = datetime.utcnow()
            db.commit()
            db.refresh(apt)

            return self._map_appointment(apt, apt.lead)
        except Exception as e:
            db.rollback()
            logger.error(f"Error updating appointment: {e}")
            raise
        finally:
            db.close()

    def cancel_appointment(self, appointment_id: str) -> bool:
        """Cancel an appointment by ID"""
        db = SessionLocal()
        try:
            apt = db.query(Appointment).filter(Appointment.id == appointment_id).first()
            if not apt:
                return False

            if not apt:
                return False

            apt.status = "cancelled"
            apt.updatedAt = datetime.utcnow()
            db.commit()

            # Map for notification
            result = self._map_appointment(apt, apt.lead)

            # Send cancellation notice
            try:
                communication_service.send_cancellation_notice(result)
            except Exception as comm_err:
                logger.error(f"Failed to send cancellation SMS: {comm_err}")

            return True
        except Exception as e:
            db.rollback()
            logger.error(f"Error cancelling appointment: {e}")
            raise
        finally:
            db.close()

    # ===== TOKEN-BASED METHODS (for user self-service) =====

    def get_appointment_by_token(self, token: str) -> Optional[Dict[str, Any]]:
        """Get appointment details by manage token (for public manage page)"""
        db = SessionLocal()
        try:
            apt = db.query(Appointment).filter(Appointment.manageToken == token).first()
            if not apt:
                return None
            return self._map_appointment(apt, apt.lead)
        finally:
            db.close()

    def cancel_by_token(self, token: str) -> Optional[Dict[str, Any]]:
        """Cancel an appointment using its manage token"""
        db = SessionLocal()
        try:
            apt = db.query(Appointment).filter(Appointment.manageToken == token).first()
            if not apt:
                return None
            if apt.status == "cancelled":
                # If already cancelled, just return (or delete if it was soft cancelled before?)
                # If we are doing hard deletes, we won't find it. 
                # But if we are migrating from soft to hard, we might find soft-cancelled ones.
                return self._map_appointment(apt, apt.lead)

            # Map details before deletion
            # result = self._map_appointment(apt, apt.lead) # This line is moved below the update

            # Soft delete
            apt.status = "cancelled"
            apt.updatedAt = datetime.utcnow()
            db.commit()
            db.refresh(apt)
            
            result = self._map_appointment(apt, apt.lead)
            
            # Send cancellation notice
            try:
                communication_service.send_cancellation_notice(result)
            except Exception as comm_err:
                logger.error(f"Failed to send cancellation SMS: {comm_err}")

            return result
        except Exception as e:
            db.rollback()
            logger.error(f"Error cancelling appointment by token: {e}")
            raise
        finally:
            db.close()

    def reschedule_by_token(self, token: str, new_date: str, new_start_time: str, new_timezone: str = None) -> Optional[Dict[str, Any]]:
        """Reschedule an appointment using its manage token"""
        db = SessionLocal()
        try:
            apt = db.query(Appointment).filter(Appointment.manageToken == token).first()
            if not apt:
                return None
            if not apt:
                return None
            
            # No need to check for cancelled status if we hard delete, 
            # but if there are legacy cancelled ones:
            if apt.status == "cancelled":
                raise ValueError("Cannot reschedule a cancelled appointment")

            # Check if new slot is available
            existing = db.query(Appointment).filter(
                Appointment.date == new_date,
                Appointment.startTime == new_start_time,
                Appointment.status.in_(["confirmed", "pending"]),
                Appointment.id != apt.id  # exclude current appointment
            ).first()
            if existing:
                raise ValueError("This time slot is already booked")

            # Calculate new end time
            start_h, start_m = map(int, new_start_time.split(":"))
            start_dt = datetime(2000, 1, 1, start_h, start_m)
            end_dt = start_dt + timedelta(minutes=apt.durationMinutes)

            apt.date = new_date
            apt.startTime = new_start_time
            apt.endTime = end_dt.strftime("%H:%M")
            if new_timezone:
                apt.timezone = new_timezone
            apt.updatedAt = datetime.utcnow()

            db.commit()
            db.refresh(apt)
            result = self._map_appointment(apt, apt.lead)
            
            # Send rescheduling notice
            try:
                communication_service.send_rescheduling_notice(result)
            except Exception as comm_err:
                logger.error(f"Failed to send rescheduling SMS: {comm_err}")

            return result
        except Exception as e:
            db.rollback()
            logger.error(f"Error rescheduling appointment: {e}")
            raise
        finally:
            db.close()

    def _generate_booking_ref(self, db) -> str:
        """Generate sequential booking reference like EDB-001"""
        max_ref = db.query(func.max(Appointment.bookingRef)).scalar()
        if max_ref and max_ref.startswith("EDB-"):
            try:
                num = int(max_ref.split("-")[1]) + 1
            except (ValueError, IndexError):
                num = 1
        else:
            num = 1
        return f"EDB-{num:03d}"

    def _map_appointment(self, apt: Appointment, lead: Optional[Lead] = None) -> Dict[str, Any]:
        """Map Appointment ORM model to response dict"""
        result = {
            "id": apt.id,
            "bookingRef": apt.bookingRef,
            "manageToken": apt.manageToken,
            "leadId": apt.leadId,
            "date": apt.date,
            "startTime": apt.startTime,
            "endTime": apt.endTime,
            "timezone": apt.timezone,
            "durationMinutes": apt.durationMinutes,
            "meetingLink": apt.meetingLink,
            "meetingId": apt.meetingId,
            "status": apt.status,
            "serviceName": apt.serviceName,
            "notes": apt.notes,
            "confirmationSentAt": apt.confirmationSentAt.isoformat() if apt.confirmationSentAt else None,
            "reminderSentAt": apt.reminderSentAt.isoformat() if apt.reminderSentAt else None,
            "createdAt": apt.createdAt.isoformat() if apt.createdAt else None,
        }

        if lead:
            result["customerName"] = f"{lead.firstName or ''} {lead.lastName or ''}".strip() or "Unknown"
            result["customerEmail"] = lead.email or ""
            result["customerPhone"] = lead.phone or ""
            result["productType"] = lead.productType

        return result

    def _map_availability_slot(self, slot: AvailabilitySlot) -> Dict[str, Any]:
        """Map AvailabilitySlot ORM model to response dict"""
        return {
            "id": slot.id,
            "dayOfWeek": slot.dayOfWeek,
            "startTime": slot.startTime,
            "endTime": slot.endTime,
            "timezone": slot.timezone,
            "slotDurationMinutes": slot.slotDurationMinutes,
            "bufferMinutes": slot.bufferMinutes,
            "isActive": slot.isActive,
        }

    def _get_default_availability(self):
        """Return default availability if none configured: Mon-Fri 9:00-17:00"""
        defaults = []
        for day in range(5):  # Mon-Fri
            defaults.append({
                "dayOfWeek": day,
                "startTime": "09:00",
                "endTime": "17:00",
                "slotDurationMinutes": 30,
                "bufferMinutes": 10,
            })
        return defaults


scheduling_service = SchedulingService()
