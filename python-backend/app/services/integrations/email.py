import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from app.core.config import settings

logger = logging.getLogger(__name__)


class EmailService:
    """
    Email service for backend-side email delivery.

    Uses SMTP when credentials are configured (SMTP_HOST, SMTP_USER, SMTP_PASS, SMTP_FROM).
    Falls back to console logging when credentials are not set.
    Frontend EmailJS handles booking confirmation/cancel/reschedule separately.
    """

    def __init__(self):
        self.host = settings.SMTP_HOST
        self.port = settings.SMTP_PORT
        self.user = settings.SMTP_USER
        self.password = settings.SMTP_PASS
        self.from_email = settings.SMTP_FROM
        self.configured = bool(self.host and self.user and self.password and self.from_email)

        if self.configured:
            logger.info(f"SMTP email configured: {self.from_email} via {self.host}:{self.port}")
        else:
            logger.info("SMTP credentials not configured; email will log only")

    def send_email(self, to: str, subject: str, body: str, html: bool = False) -> dict:
        """
        Send an email via SMTP when configured, otherwise log to console.
        """
        if self.configured:
            try:
                msg = MIMEMultipart("alternative")
                msg["From"] = self.from_email
                msg["To"] = to
                msg["Subject"] = subject

                content_type = "html" if html else "plain"
                msg.attach(MIMEText(body, content_type))

                with smtplib.SMTP(self.host, self.port) as server:
                    server.starttls()
                    server.login(self.user, self.password)
                    server.sendmail(self.from_email, to, msg.as_string())

                logger.info(f"EMAIL sent: To={to} | Subject={subject}")
                return {"success": True, "to": to, "subject": subject, "delivered": True}
            except Exception as exc:
                logger.error(f"EMAIL failed: To={to} | Subject={subject} | Error={exc}")
                return {"success": False, "to": to, "subject": subject, "error": str(exc)}

        logger.info(f"[LOG-ONLY EMAIL] To={to} | Subject={subject}")
        logger.info(f"   Body preview: {body[:200]}...")
        return {"success": True, "to": to, "subject": subject, "delivered": False, "mock": True}

    def get_status(self) -> dict:
        return {
            "provider": "smtp" if self.configured else "frontend_emailjs",
            "serverDelivery": self.configured,
            "mode": "live" if self.configured else "log_only",
            "host": self.host if self.configured else None,
            "from": self.from_email if self.configured else None,
        }

    def generate_booking_confirmation_payload(self, appointment: dict) -> dict:
        """Generate structured data for EmailJS template."""
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
        """Generate structured data for reminder EmailJS template."""
        return {
            "to_email": appointment.get("customerEmail", ""),
            "to_name": appointment.get("customerName", ""),
            "appointment_date": appointment.get("date", ""),
            "appointment_time": appointment.get("startTime", ""),
            "meeting_link": appointment.get("meetingLink", ""),
            "service_name": appointment.get("serviceName", "Insurance Consultation"),
        }
