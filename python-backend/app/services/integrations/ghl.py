import httpx
from app.core.config import settings

class GHLService:
    def __init__(self):
        self.api_key = settings.GHL_API_KEY
        self.location_id = settings.GHL_LOCATION_ID
        self.base_url = "https://rest.gohighlevel.com/v1"
    
    async def create_contact(self, contact_data: dict):
        if not self.api_key:
            print(f"[MOCK GHL] Creating contact: {contact_data}")
            return {"id": "mock-ghl-id"}
            
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    f"{self.base_url}/contacts/",
                    json=contact_data,
                    headers={"Authorization": f"Bearer {self.api_key}"}
                )
                response.raise_for_status()
                return response.json()
            except Exception as e:
                print(f"GHL create_contact error: {e}")
                return None

    async def update_contact(self, contact_id: str, update_data: dict):
        if not self.api_key:
            print(f"[MOCK GHL] Updating contact {contact_id}: {update_data}")
            return {"id": contact_id, "mock": True}
            
        async with httpx.AsyncClient() as client:
            try:
                response = await client.put(
                    f"{self.base_url}/contacts/{contact_id}",
                    json=update_data,
                    headers={"Authorization": f"Bearer {self.api_key}"}
                )
                response.raise_for_status()
                return response.json()
            except Exception as e:
                print(f"GHL update_contact error: {e}")
                return None

    async def add_note(self, contact_id: str, note_body: str):
        if not self.api_key:
            print(f"[MOCK GHL] Adding note to {contact_id}: {note_body}")
            return True
            
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    f"{self.base_url}/contacts/{contact_id}/notes",
                    json={"body": note_body},
                    headers={"Authorization": f"Bearer {self.api_key}"}
                )
                response.raise_for_status()
                return response.json()
            except Exception as e:
                print(f"GHL add_note error: {e}")
                return None

ghl_service = GHLService()
