import logging
from typing import Any, Dict

from app.core.config import settings
from app.services.integrations.email import EmailService
from app.services.integrations.twilio import TwilioService

logger = logging.getLogger(__name__)


class CommunicationService:
    """
    Orchestrator for booking confirmations, reminders, and notifications.
    Uses EmailService for backend-side logging and TwilioService for SMS.
    """

    def __init__(self):
        self.email_service = EmailService()
        self.twilio_service = TwilioService()

    def _absolute_url(self, path: str) -> str:
        base_url = (settings.APP_BASE_URL or "").rstrip("/")
        target = (path or "").strip()

        if not target:
            return base_url
        if target.startswith("http://") or target.startswith("https://"):
            return target
        if not base_url:
            return target
        if not target.startswith("/"):
            target = f"/{target}"
        return f"{base_url}{target}"

    def _manage_url(self, token: str) -> str:
        if not token:
            return ""
        return self._absolute_url(f"/appointment/manage/{token}")

    def get_status(self) -> Dict[str, Any]:
        return {
            "appBaseUrl": settings.APP_BASE_URL,
            "sms": self.twilio_service.get_status(),
            "email": self.email_service.get_status(),
        }

    def send_booking_confirmation(self, appointment: Dict[str, Any]) -> Dict[str, bool]:
        """Send booking confirmation via email log and SMS."""
        results = {"email": False, "sms": False}

        customer_name = appointment.get("customerName", "Customer")
        customer_email = appointment.get("customerEmail", "")
        customer_phone = appointment.get("customerPhone", "")
        date = appointment.get("date", "")
        start_time = appointment.get("startTime", "")
        end_time = appointment.get("endTime", "")
        meeting_link = self._absolute_url(appointment.get("meetingLink", ""))
        service_name = appointment.get("serviceName", "Insurance Consultation")
        booking_ref = appointment.get("bookingRef", "")
        manage_link = self._manage_url(appointment.get("manageToken", ""))

        if customer_email:
            try:
                email_lines = [
                    f"Hi {customer_name},",
                    "",
                    f"Your {service_name} has been confirmed.",
                    "",
                    f"Booking Reference: {booking_ref}",
                    f"Date: {date}",
                    f"Time: {start_time} - {end_time}",
                    f"Meeting Link: {meeting_link}",
                ]
                if manage_link:
                    email_lines.extend(
                        [
                            "",
                            "Need to cancel or reschedule?",
                            f"Manage your appointment: {manage_link}",
                        ]
                    )
                email_lines.extend(["", "We look forward to speaking with you!", "", "Best regards,", "Elite Deal Broker Team"])
                self.email_service.send_email(
                    customer_email,
                    f"Booking Confirmed - {service_name} ({booking_ref})",
                    "\n".join(email_lines),
                )
                results["email"] = True
                logger.info(f"Booking confirmation email logged for {customer_email}")
            except Exception as exc:
                logger.error(f"Failed to log booking confirmation email: {exc}")

        if customer_phone:
            try:
                sms_body = (
                    f"Hi {customer_name}! Your {service_name} ({booking_ref}) on {date} "
                    f"at {start_time} has been confirmed. Meeting link: {meeting_link}"
                )
                if manage_link:
                    sms_body = f"{sms_body} Manage: {manage_link}"
                self.twilio_service.send_sms(customer_phone, sms_body)
                results["sms"] = True
                logger.info(f"Booking confirmation SMS sent to {customer_phone}")
            except Exception as exc:
                logger.error(f"Failed to send booking confirmation SMS: {exc}")

        return results

    def send_booking_reminder(self, appointment: Dict[str, Any]) -> Dict[str, bool]:
        """Send booking reminder via email log and SMS."""
        results = {"email": False, "sms": False}

        customer_name = appointment.get("customerName", "Customer")
        customer_email = appointment.get("customerEmail", "")
        customer_phone = appointment.get("customerPhone", "")
        date = appointment.get("date", "")
        start_time = appointment.get("startTime", "")
        meeting_link = self._absolute_url(appointment.get("meetingLink", ""))
        service_name = appointment.get("serviceName", "Insurance Consultation")

        if customer_email:
            try:
                self.email_service.send_email(
                    customer_email,
                    f"Reminder: {service_name} starts in 15 minutes",
                    (
                        f"Hi {customer_name},\n\n"
                        f"This is a reminder that your {service_name} is scheduled for "
                        f"{date} at {start_time}, which starts in about 15 minutes.\n\n"
                        f"Meeting Link: {meeting_link}\n\n"
                        f"See you soon!\nElite Deal Broker Team"
                    ),
                )
                results["email"] = True
            except Exception as exc:
                logger.error(f"Failed to send reminder email: {exc}")

        if customer_phone:
            try:
                sms_body = (
                    f"Reminder: Your {service_name} starts in 15 min at {start_time}. "
                    f"Join: {meeting_link}"
                )
                self.twilio_service.send_sms(customer_phone, sms_body)
                results["sms"] = True
            except Exception as exc:
                logger.error(f"Failed to send reminder SMS: {exc}")

        return results

    def send_cancellation_notice(self, appointment: Dict[str, Any]) -> Dict[str, bool]:
        """Send cancellation notification."""
        results = {"email": False, "sms": False}

        customer_name = appointment.get("customerName", "Customer")
        customer_email = appointment.get("customerEmail", "")
        customer_phone = appointment.get("customerPhone", "")
        date = appointment.get("date", "")
        service_name = appointment.get("serviceName", "Insurance Consultation")
        contact_url = self._absolute_url("/contact")

        if customer_email:
            try:
                self.email_service.send_email(
                    customer_email,
                    f"Appointment Cancelled - {service_name}",
                    (
                        f"Hi {customer_name},\n\n"
                        f"Your {service_name} on {date} has been cancelled.\n\n"
                        f"If you'd like to book again, please visit {contact_url}.\n\n"
                        f"Best,\nElite Deal Broker Team"
                    ),
                )
                results["email"] = True
            except Exception as exc:
                logger.error(f"Failed to send cancellation email: {exc}")

        if customer_phone:
            try:
                self.twilio_service.send_sms(
                    customer_phone,
                    f"Your {service_name} on {date} has been cancelled. Visit {contact_url} to book again.",
                )
                results["sms"] = True
            except Exception as exc:
                logger.error(f"Failed to send cancellation SMS: {exc}")

        return results

    def send_rescheduling_notice(self, appointment: Dict[str, Any]) -> Dict[str, bool]:
        """Send rescheduling notification."""
        results = {"email": False, "sms": False}

        customer_name = appointment.get("customerName", "Customer")
        customer_email = appointment.get("customerEmail", "")
        customer_phone = appointment.get("customerPhone", "")
        date = appointment.get("date", "")
        start_time = appointment.get("startTime", "")
        service_name = appointment.get("serviceName", "Insurance Consultation")
        meeting_link = self._absolute_url(appointment.get("meetingLink", ""))

        if customer_email:
            try:
                self.email_service.send_email(
                    customer_email,
                    f"Appointment Rescheduled - {service_name}",
                    (
                        f"Hi {customer_name},\n\n"
                        f"Your {service_name} has been rescheduled to {date} at {start_time}.\n\n"
                        f"Link: {meeting_link}\n\n"
                        f"Best,\nElite Deal Broker Team"
                    ),
                )
                results["email"] = True
            except Exception as exc:
                logger.error(f"Failed to send rescheduling email: {exc}")

        if customer_phone:
            try:
                self.twilio_service.send_sms(
                    customer_phone,
                    f"Your {service_name} has been rescheduled to {date} at {start_time}. New link: {meeting_link}",
                )
                results["sms"] = True
            except Exception as exc:
                logger.error(f"Failed to send rescheduling SMS: {exc}")

        return results


communication_service = CommunicationService()
