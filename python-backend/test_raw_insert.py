import requests
import json
import uuid
import sys
from app.core.config import settings

url = f"{settings.SUPABASE_URL}/rest/v1/Lead"
headers = {
    "apikey": settings.SUPABASE_SERVICE_ROLE_KEY,
    "Authorization": f"Bearer {settings.SUPABASE_SERVICE_ROLE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "resolution=merge-duplicates,return=representation"
}

lead_id = str(uuid.uuid4())
payload = {
    "id": lead_id,
    "productType": "aca",
    "state": "FL",
    "firstName": "UpsertTest",
    "lastName": "User",
    "email": f"upsert_{lead_id}@example.com"
}

print(f"Sending Upsert Request to {url}...")
print(f"Payload: {payload}")

try:
    response = requests.post(url, json=payload, headers=headers)
    print(f"Status: {response.status_code}")
    print(f"Response: {response.text}")
except Exception as e:
    print(f"Error: {e}")
