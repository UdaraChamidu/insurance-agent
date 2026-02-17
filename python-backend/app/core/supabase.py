from supabase import create_client, Client
from app.core.config import settings

def get_supabase() -> Client:
    url: str = settings.SUPABASE_URL
    key: str = settings.SUPABASE_SERVICE_ROLE_KEY or settings.SUPABASE_KEY
    try:
        if not url or not key:
            print(f"Error: Supabase config missing. URL: {url}, Key: {'*' * 5 if key else 'None'}")
            return None
        return create_client(url, key)
    except Exception as e:
        print(f"Failed to initialize Supabase client: {e}")
        return None

supabase: Client = get_supabase()
