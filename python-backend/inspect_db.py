import sys
import os
from dotenv import load_dotenv

load_dotenv(override=True)

try:
    from app.core.supabase import supabase
    
    print("Fetching one Lead...")
    # Fetch 1 record to see column names
    res = supabase.table("Lead").select("*").limit(1).execute()
    
    if res.data:
        print("Keys in Lead table:")
        print(res.data[0].keys())
    else:
        print("No leads found. Trying to insert a dummy one to see error or structure if possible... wait, can't insert if we don't know structure.")
        print("Empty table.")

except Exception as e:
    print(f"Error: {e}")
