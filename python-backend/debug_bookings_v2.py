import sys
import os
import json
from datetime import datetime, timedelta, timezone
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
        
        # Try a safer range: Today +/- 5 days.
        # Graph API sometimes flakes on very large ranges or specific datetime formats
        # Ensure UTC 'Z' is used if possible, or standard ISO
        
        start = datetime.utcnow().isoformat() + "Z"
        end = (datetime.utcnow() + timedelta(days=60)).isoformat() + "Z"
        
        print(f"Querying Appointments: {start} to {end}")
        
        try:
            # We need to manually call here to debug the exact URL
            import requests
            headers = bookings_service._get_headers()
            url = f"https://graph.microsoft.com/v1.0/solutions/bookingBusinesses/{b['id']}/calendarView"
            params = {
                "start": start,
                "end": end
            }
            res = requests.get(url, headers=headers, params=params)
            print(f"Status: {res.status_code}")
            if res.status_code != 200:
                print(f"Error Body: {res.text}")
            else:
                data = res.json()
                print(f"Found {len(data.get('value', []))} appointments.")
                for apt in data.get('value', []):
                     print(f" - {apt.get('customerName')} : {apt.get('serviceName')}")
        except Exception as e:
            print(f"Request Failed: {e}")

except Exception as e:
    print(f"\n❌ ERROR: {str(e)}")
