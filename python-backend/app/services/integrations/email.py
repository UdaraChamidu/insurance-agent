class EmailService:
    def __init__(self):
        pass

    async def send_email(self, to: str, subject: str, body: str):
        print(f"[MOCK EMAIL] To: {to}, Subject: {subject}")
        return True

email_service = EmailService()
