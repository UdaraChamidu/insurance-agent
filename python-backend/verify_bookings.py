import sys
import os
import json
from datetime import datetime, timedelta
from dotenv import load_dotenv

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

load_dotenv(override=True)

try:
    from app.services.bookings_service import bookings_service
    
    print("1. Testing Microsoft Auth & Booking Businesses...")
    businesses = bookings_service.get_booking_businesses()
    
    if not businesses:
        print("   ❌ No booking businesses found. Ensure your Azure app has 'Bookings.Read.All'.")
    else:
        print(f"   ✅ Found {len(businesses)} booking business(es):")
        for b in businesses:
            print(f"      - {b.get('displayName')} (ID: {b.get('id')})")
            
        print("\n2. Fetching Appointments (Default Range: -30 to +60 days)...")
        # Use service defaults which handle UTC formatting correctly
        appointments = bookings_service.get_appointments()
        
        print(f"   ✅ Found {len(appointments)} appointments.")
        
        if appointments:
            print("\n   Sample Appointment:")
            print(json.dumps(appointments[0], indent=2))
            
except Exception as e:
    print(f"\n❌ STARTUP FAILED: {str(e)}")
    import traceback
    traceback.print_exc()
