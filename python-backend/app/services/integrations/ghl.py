import httpx
import os
from app.core.config import settings

class GHLService:
    def __init__(self):
        self.api_key = settings.GHL_API_KEY
        self.location_id = settings.GHL_LOCATION_ID
        self.base_url = "https://rest.gohighlevel.com/v1"
        connect_timeout = self._read_positive_float_env("GHL_CONNECT_TIMEOUT_SEC", 5.0)
        read_timeout = self._read_positive_float_env("GHL_READ_TIMEOUT_SEC", 20.0)
        write_timeout = self._read_positive_float_env("GHL_WRITE_TIMEOUT_SEC", 20.0)
        pool_timeout = self._read_positive_float_env("GHL_POOL_TIMEOUT_SEC", 5.0)
        self.http_timeout = httpx.Timeout(
            connect=connect_timeout,
            read=read_timeout,
            write=write_timeout,
            pool=pool_timeout,
        )

    def _read_positive_float_env(self, key: str, default: float) -> float:
        raw = os.getenv(key, "").strip()
        if not raw:
            return default
        try:
            parsed = float(raw)
            return parsed if parsed > 0 else default
        except ValueError:
            return default
    
    async def create_contact(self, contact_data: dict):
        if not self.api_key:
            print(f"[MOCK GHL] Creating contact: {contact_data}")
            return {"id": "mock-ghl-id"}
            
        async with httpx.AsyncClient(timeout=self.http_timeout) as client:
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
            
        async with httpx.AsyncClient(timeout=self.http_timeout) as client:
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
            
        async with httpx.AsyncClient(timeout=self.http_timeout) as client:
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
