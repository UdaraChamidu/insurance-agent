import logging
from app.core.config import settings

logger = logging.getLogger(__name__)


class TwilioService:
    """
    SMS service using Twilio.
    Falls back to console logging when credentials are not configured.
    """

    def __init__(self):
        self.account_sid = settings.TWILIO_ACCOUNT_SID
        self.auth_token = settings.TWILIO_AUTH_TOKEN
        self.from_number = settings.TWILIO_PHONE_NUMBER
        self.client = None

        if self.account_sid and self.auth_token and self.from_number:
            try:
                from twilio.rest import Client
                self.client = Client(self.account_sid, self.auth_token)
                logger.info("✅ Twilio client initialized successfully")
            except Exception as e:
                logger.warning(f"⚠️ Twilio client failed to initialize: {e}")
                self.client = None
        else:
            logger.info("📱 Twilio credentials not configured – using mock mode")

    def send_sms(self, to: str, body: str) -> dict:
        """
        Send an SMS message.
        Uses Twilio when configured, falls back to console logging.
        """
        if self.client and self.from_number:
            try:
                message = self.client.messages.create(
                    body=body,
                    from_=self.from_number,
                    to=to,
                )
                logger.info(f"📱 SMS sent to {to} | SID: {message.sid}")
                return {"success": True, "sid": message.sid, "to": to}
            except Exception as e:
                logger.error(f"❌ Twilio SMS failed to {to}: {e}")
                return {"success": False, "error": str(e)}
        else:
            # Mock mode
            logger.info(f"📱 [MOCK SMS] To: {to} | Body: {body[:100]}...")
            return {"success": True, "mock": True, "to": to}
