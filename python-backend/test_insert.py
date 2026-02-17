import sys
import uuid
import os
from dotenv import load_dotenv

load_dotenv(override=True)

try:
    from app.core.config import settings
    # verify key
    print(f"Service Key loaded: {bool(settings.SUPABASE_SERVICE_ROLE_KEY)}")
    from app.core.supabase import supabase
    
    lead_id = str(uuid.uuid4())
    print("Fetching Session schema...")
    res_schema = supabase.table("Session").select("*").limit(1).execute()
    if res_schema.data:
        print(f"Session Keys: {res_schema.data[0].keys()}")
        
    payload = {
        "Id": lead_id, # Try PascalCase
        "LeadId": "00000000-0000-0000-0000-000000000000",
        "Status": "new",
        "CreatedAt": "2023-10-27T10:00:00Z"
    }
    
    print(f"Inserting into Session with PascalCase: {payload}")
    res = supabase.table("Session").insert(payload).execute()
    print("Insert success!")
    print(res.data)

except Exception as e:
    print(f"Insert Failed: {e}")
