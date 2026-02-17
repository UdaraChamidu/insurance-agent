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
    
    print("Fetching Booking Businesses...")
    businesses = bookings_service.get_booking_businesses()
    for b in businesses:
        print(f"\nBusiness: {b.get('displayName')} (ID: {b.get('id')})")
        
        # Check a wide range: -30 days to +60 days
        start = (datetime.now() - timedelta(days=30)).isoformat()
        end = (datetime.now() + timedelta(days=60)).isoformat()
        
        print(f"Querying Appointments: {start} to {end}")
        
        # We use the internal method _get_headers and manual request to bypass service specific defaults if needed,
        # but the service method accepts start/end so we use that.
        
        appointments = bookings_service.get_appointments(start_date=start, end_date=end)
        print(f"Found {len(appointments)} appointments.")
        
        for apt in appointments:
            print(f" - [{apt.get('status')}] {apt.get('customerName')} : {apt.get('serviceName')}")
            print(f"   Time: {apt.get('startDateTime')} - {apt.get('endDateTime')}")
            
except Exception as e:
    print(f"\n❌ ERROR: {str(e)}")
    import traceback
    traceback.print_exc()
