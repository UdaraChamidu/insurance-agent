import logging

logger = logging.getLogger(__name__)


class EmailService:
    """
    Email service for backend-side email handling.
    
    Actual emails are sent from the frontend using EmailJS.
    This service handles:
    - Logging email events for audit trail
    - Generating email data payloads
    - Server-side email triggers (mock/development mode)
    """

    def send_email(self, to: str, subject: str, body: str):
        """
        Log email send event.
        In production, this logs the event. Actual sending is done via
        frontend EmailJS or can be extended to use SMTP/SES later.
        """
        logger.info(f"📧 EMAIL: To={to} | Subject={subject}")
        logger.info(f"   Body preview: {body[:200]}...")
        # In production, integrate with SMTP or email API here
        return {"success": True, "to": to, "subject": subject}

    def generate_booking_confirmation_payload(self, appointment: dict) -> dict:
        """Generate structured data for EmailJS template"""
        return {
            "to_email": appointment.get("customerEmail", ""),
            "to_name": appointment.get("customerName", ""),
            "appointment_date": appointment.get("date", ""),
            "appointment_time": appointment.get("startTime", ""),
            "appointment_end_time": appointment.get("endTime", ""),
            "meeting_link": appointment.get("meetingLink", ""),
            "service_name": appointment.get("serviceName", "Insurance Consultation"),
            "timezone": appointment.get("timezone", ""),
        }

    def generate_reminder_payload(self, appointment: dict) -> dict:
        """Generate structured data for reminder EmailJS template"""
        return {
            "to_email": appointment.get("customerEmail", ""),
            "to_name": appointment.get("customerName", ""),
            "appointment_date": appointment.get("date", ""),
            "appointment_time": appointment.get("startTime", ""),
            "meeting_link": appointment.get("meetingLink", ""),
            "service_name": appointment.get("serviceName", "Insurance Consultation"),
        }
