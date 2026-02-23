import asyncio
import logging
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from app.core.database import SessionLocal
from app.models import Appointment
from app.services.communication_service import communication_service

logger = logging.getLogger(__name__)


class AppointmentReminderPoller:
    """
    Sends one reminder when an appointment is 15 minutes away.
    """

    def __init__(self):
        self.is_running = False
        self._task = None
        self.poll_interval_seconds = 60

    async def start(self):
        if self.is_running:
            return
        self.is_running = True
        logger.info("Starting Appointment Reminder Poller...")
        self._task = asyncio.create_task(self._poll_loop())

    async def stop(self):
        self.is_running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("Appointment Reminder Poller stopped.")

    async def _poll_loop(self):
        while self.is_running:
            try:
                await asyncio.to_thread(self._process_due_reminders)
            except Exception as exc:
                logger.error(f"Error in appointment reminder poll loop: {exc}")
            await asyncio.sleep(self.poll_interval_seconds)

    def _process_due_reminders(self):
        db = SessionLocal()
        try:
            now_utc = datetime.now(timezone.utc)
            candidates = db.query(Appointment).filter(
                Appointment.status.in_(["confirmed", "pending"]),
                Appointment.reminderSentAt.is_(None),
            ).all()

            for apt in candidates:
                start_utc = self._appointment_start_to_utc(apt.date, apt.startTime, apt.timezone)
                if start_utc is None:
                    continue

                reminder_utc = start_utc - timedelta(minutes=15)
                if not (reminder_utc <= now_utc < start_utc):
                    continue

                payload = self._map_appointment_for_communication(apt)
                results = communication_service.send_booking_reminder(payload)
                if results.get("email"):
                    apt.reminderSentAt = datetime.utcnow()
                    db.add(apt)
                    db.commit()
                    logger.info(
                        "15-minute reminder sent for appointment %s (%s %s %s)",
                        apt.id,
                        apt.date,
                        apt.startTime,
                        apt.timezone,
                    )
                else:
                    logger.warning(
                        "Reminder email failed for appointment %s; will retry.",
                        apt.id,
                    )
        finally:
            db.close()

    def _appointment_start_to_utc(self, date_str: str, time_str: str, tz_name: str):
        try:
            tz = ZoneInfo(tz_name or "UTC")
        except Exception:
            logger.warning("Unknown timezone '%s'; falling back to UTC.", tz_name)
            tz = timezone.utc

        try:
            local_start = datetime.strptime(
                f"{date_str} {time_str}", "%Y-%m-%d %H:%M"
            ).replace(tzinfo=tz)
        except Exception:
            logger.warning(
                "Invalid appointment date/time for reminder: date=%s time=%s",
                date_str,
                time_str,
            )
            return None

        return local_start.astimezone(timezone.utc)

    def _map_appointment_for_communication(self, apt: Appointment):
        lead = apt.lead
        return {
            "id": apt.id,
            "bookingRef": apt.bookingRef,
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
            "customerName": f"{(lead.firstName or '').strip()} {(lead.lastName or '').strip()}".strip() or "Unknown",
            "customerEmail": lead.email if lead else "",
            "customerPhone": lead.phone if lead else "",
        }


appointment_reminder_poller = AppointmentReminderPoller()
