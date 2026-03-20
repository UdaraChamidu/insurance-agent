import logging
import re
from typing import Any, Dict

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
                logger.info("Twilio client initialized successfully")
            except Exception as exc:
                logger.warning(f"Twilio client failed to initialize: {exc}")
                self.client = None
        else:
            logger.info("Twilio credentials not configured; using mock mode")

    def _normalize_phone_number(self, number: str) -> str:
        raw = (number or "").strip()
        if not raw:
            return ""

        digits = re.sub(r"\D", "", raw)
        if not digits:
            return raw

        if raw.startswith("+"):
            return f"+{digits}"
        if len(digits) == 10:
            return f"+1{digits}"
        if len(digits) == 11 and digits.startswith("1"):
            return f"+{digits}"
        if 8 <= len(digits) <= 15:
            return f"+{digits}"
        return raw

    def _mask_number(self, number: str) -> str:
        normalized = self._normalize_phone_number(number)
        if len(normalized) <= 4:
            return normalized
        return f"{normalized[:3]}***{normalized[-2:]}"

    def get_status(self) -> Dict[str, Any]:
        configured = bool(self.account_sid and self.auth_token and self.from_number)
        live = bool(self.client and self.from_number)
        return {
            "configured": configured,
            "live": live,
            "mode": "live" if live else "mock",
            "fromNumber": self._mask_number(self.from_number),
        }

    def send_sms(self, to: str, body: str) -> dict:
        """
        Send an SMS message.
        Uses Twilio when configured, falls back to console logging.
        """
        normalized_to = self._normalize_phone_number(to)

        if self.client and self.from_number:
            try:
                message = self.client.messages.create(
                    body=body,
                    from_=self.from_number,
                    to=normalized_to or to,
                )
                logger.info(f"SMS sent to {normalized_to or to} | SID: {message.sid}")
                return {"success": True, "sid": message.sid, "to": normalized_to or to}
            except Exception as exc:
                logger.error(f"Twilio SMS failed to {normalized_to or to}: {exc}")
                return {"success": False, "error": str(exc)}

        logger.info(f"[MOCK SMS] To: {normalized_to or to} | Body: {body[:100]}...")
        return {"success": True, "mock": True, "to": normalized_to or to}
