import logging
from typing import Optional, Dict, Any
from app.services.integrations.email import EmailService
from app.services.integrations.twilio import TwilioService

logger = logging.getLogger(__name__)


class CommunicationService:
    """
    Orchestrator for booking confirmations, reminders, and notifications.
    Uses EmailService (backend side, mostly logging) and TwilioService for SMS.
    Note: Frontend EmailJS handles actual email sending for booking confirmations.
    """

    def __init__(self):
        self.email_service = EmailService()
        self.twilio_service = TwilioService()

    def send_booking_confirmation(self, appointment: Dict[str, Any]) -> Dict[str, bool]:
        """Send booking confirmation via email (backend log) and SMS"""
        results = {"email": False, "sms": False}
        
        customer_name = appointment.get("customerName", "Customer")
        customer_email = appointment.get("customerEmail", "")
        customer_phone = appointment.get("customerPhone", "")
        date = appointment.get("date", "")
        start_time = appointment.get("startTime", "")
        end_time = appointment.get("endTime", "")
        meeting_link = appointment.get("meetingLink", "")
        service_name = appointment.get("serviceName", "Insurance Consultation")
        booking_ref = appointment.get("bookingRef", "")
        manage_token = appointment.get("manageToken", "")

        # Email confirmation (backend side – log/record, actual send via frontend EmailJS)
        try:
            email_data = {
                "to": customer_email,
                "subject": f"Booking Confirmed – {service_name} ({booking_ref})",
                "body": (
                    f"Hi {customer_name},\n\n"
                    f"Your {service_name} has been confirmed.\n\n"
                    f"📋 Booking Reference: {booking_ref}\n"
                    f"📅 Date: {date}\n"
                    f"🕐 Time: {start_time} – {end_time}\n"
                    f"🔗 Meeting Link: {meeting_link}\n\n"
                    + (f"Need to cancel or reschedule?\n"
                       f"Manage your appointment: /appointment/manage/{manage_token}\n\n"
                       if manage_token else "")
                    + f"We look forward to speaking with you!\n\n"
                    f"Best regards,\nElite Deal Broker Team"
                ),
            }
            self.email_service.send_email(
                email_data["to"],
                email_data["subject"],
                email_data["body"],
            )
            results["email"] = True
            logger.info(f"Booking confirmation email logged for {customer_email}")
        except Exception as e:
            logger.error(f"Failed to log booking confirmation email: {e}")

        # SMS confirmation via Twilio
        if customer_phone:
            try:
                sms_body = (
                    f"Hi {customer_name}! Your {service_name} ({booking_ref}) on {date} "
                    f"at {start_time} has been confirmed. "
                    f"Meeting link: {meeting_link}"
                )
                self.twilio_service.send_sms(customer_phone, sms_body)
                results["sms"] = True
                logger.info(f"Booking confirmation SMS sent to {customer_phone}")
            except Exception as e:
                logger.error(f"Failed to send booking confirmation SMS: {e}")

        return results

    def send_booking_reminder(self, appointment: Dict[str, Any]) -> Dict[str, bool]:
        """Send booking reminder via email and SMS"""
        results = {"email": False, "sms": False}

        customer_name = appointment.get("customerName", "Customer")
        customer_email = appointment.get("customerEmail", "")
        customer_phone = appointment.get("customerPhone", "")
        date = appointment.get("date", "")
        start_time = appointment.get("startTime", "")
        meeting_link = appointment.get("meetingLink", "")
        service_name = appointment.get("serviceName", "Insurance Consultation")

        # Email reminder
        try:
            self.email_service.send_email(
                customer_email,
                f"Reminder: {service_name} Tomorrow",
                (
                    f"Hi {customer_name},\n\n"
                    f"This is a reminder that your {service_name} is scheduled for "
                    f"tomorrow, {date} at {start_time}.\n\n"
                    f"Meeting Link: {meeting_link}\n\n"
                    f"See you soon!\nElite Deal Broker Team"
                ),
            )
            results["email"] = True
        except Exception as e:
            logger.error(f"Failed to send reminder email: {e}")

        # SMS reminder
        if customer_phone:
            try:
                sms_body = (
                    f"Reminder: Your {service_name} is tomorrow at {start_time}. "
                    f"Join: {meeting_link}"
                )
                self.twilio_service.send_sms(customer_phone, sms_body)
                results["sms"] = True
            except Exception as e:
                logger.error(f"Failed to send reminder SMS: {e}")

        return results

    def send_cancellation_notice(self, appointment: Dict[str, Any]) -> Dict[str, bool]:
        """Send cancellation notification"""
        results = {"email": False, "sms": False}

        customer_name = appointment.get("customerName", "Customer")
        customer_email = appointment.get("customerEmail", "")
        customer_phone = appointment.get("customerPhone", "")
        date = appointment.get("date", "")
        service_name = appointment.get("serviceName", "Insurance Consultation")

        try:
            self.email_service.send_email(
                customer_email,
                f"Appointment Cancelled – {service_name}",
                (
                    f"Hi {customer_name},\n\n"
                    f"Your {service_name} on {date} has been cancelled.\n\n"
                    f"If you'd like to reschedule, please visit our website.\n\n"
                    f"Best,\nElite Deal Broker Team"
                ),
            )
            results["email"] = True
        except Exception as e:
            logger.error(f"Failed to send cancellation email: {e}")

        if customer_phone:
            try:
                self.twilio_service.send_sms(
                    customer_phone,
                    f"Your {service_name} on {date} has been cancelled. "
                    f"Visit our site to reschedule."
                )
                results["sms"] = True
            except Exception as e:
                logger.error(f"Failed to send cancellation SMS: {e}")

        return results

    def send_rescheduling_notice(self, appointment: Dict[str, Any]) -> Dict[str, bool]:
        """Send rescheduling notification"""
        results = {"email": False, "sms": False}

        customer_name = appointment.get("customerName", "Customer")
        customer_email = appointment.get("customerEmail", "")
        customer_phone = appointment.get("customerPhone", "")
        date = appointment.get("date", "")
        start_time = appointment.get("startTime", "")
        service_name = appointment.get("serviceName", "Insurance Consultation")
        meeting_link = appointment.get("meetingLink", "")

        try:
            self.email_service.send_email(
                customer_email,
                f"Appointment Rescheduled – {service_name}",
                (
                    f"Hi {customer_name},\n\n"
                    f"Your {service_name} has been rescheduled to {date} at {start_time}.\n\n"
                    f"Link: {meeting_link}\n\n"
                    f"Best,\nElite Deal Broker Team"
                ),
            )
            results["email"] = True
        except Exception as e:
            logger.error(f"Failed to send rescheduling email: {e}")

        if customer_phone:
            try:
                self.twilio_service.send_sms(
                    customer_phone,
                    f"Your {service_name} has been rescheduled to {date} at {start_time}. "
                    f"New Link: {meeting_link}"
                )
                results["sms"] = True
            except Exception as e:
                logger.error(f"Failed to send rescheduling SMS: {e}")

        return results


communication_service = CommunicationService()
