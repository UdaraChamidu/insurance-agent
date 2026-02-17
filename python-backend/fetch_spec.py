import requests
import json
from app.core.config import settings

url = f"{settings.SUPABASE_URL}/rest/v1/"
headers = {
    "apikey": settings.SUPABASE_SERVICE_ROLE_KEY
}

try:
    response = requests.get(url, headers=headers)
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        spec = response.json()
        lead_def = spec.get("definitions", {}).get("Lead", {})
        print(json.dumps(lead_def, indent=2))
    else:
        print(f"Error: {response.text}")

except Exception as e:
    print(f"Error: {e}")
