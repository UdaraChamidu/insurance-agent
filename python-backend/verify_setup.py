import sys
import os
import traceback
from dotenv import load_dotenv

# Force reload of env
load_dotenv(override=True)

try:
    print("Loading settings...")
    from app.core.config import settings
    print("Settings loaded.")
except Exception:
    print("Failed to load settings:")
    traceback.print_exc()

try:
    print("Initializing Supabase...")
    from app.core.supabase import supabase
    print("Supabase imported.")
except Exception:
    print("Failed to import Supabase client module:")
    traceback.print_exc()

try:
    print("Checking Meeting endpoints...")
    from app.api.v1.endpoints import meetings
    print("Meetings endpoint loaded.")
except Exception:
    print("Failed to load Meetings endpoint:")
    traceback.print_exc()

try:
    print("Checking API router...")
    from app.api.v1.api import api_router
    print("API Router loaded.")
except Exception:
    print("Failed to load API router:")
    traceback.print_exc()

except Exception as e:
    import traceback
    print("An error occurred:")
    traceback.print_exc()
