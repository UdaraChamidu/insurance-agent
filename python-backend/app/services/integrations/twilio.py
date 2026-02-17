from twilio.rest import Client
from app.core.config import settings

class TwilioService:
    def __init__(self):
        self.account_sid = settings.TWILIO_ACCOUNT_SID
        self.auth_token = settings.TWILIO_AUTH_TOKEN
        self.from_number = settings.TWILIO_PHONE_NUMBER
        
        if self.account_sid and self.auth_token:
            self.client = Client(self.account_sid, self.auth_token)
        else:
            self.client = None

    async def send_sms(self, to: str, body: str):
        if not self.client:
            print(f"[MOCK SMS] To: {to}, Msg: {body}")
            return True
            
        try:
            # Twilio's async client is separate, or run in executor
            # For simplicity, using sync client in thread pool or just assuming quick execution
            # Ideally use twilio.rest.Client(..., http_client=AsyncTwilioHttpClient())
            message = self.client.messages.create(
                body=body,
                from_=self.from_number,
                to=to
            )
            return message.sid
        except Exception as e:
            print(f"Twilio SMS error: {e}")
            return False

twilio_service = TwilioService()
