import requests
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
from app.core.microsoft_auth import microsoft_auth

logger = logging.getLogger(__name__)

class BookingsService:
    def __init__(self):
        self.booking_business_id = None

    def _get_headers(self) -> Dict[str, str]:
        token = microsoft_auth.get_access_token()
        return {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }

    def get_booking_businesses(self) -> List[Dict[str, Any]]:
        """Get all booking businesses for the organization"""
        try:
            logger.info("Fetching booking businesses...")
            headers = self._get_headers()
            url = "https://graph.microsoft.com/v1.0/solutions/bookingBusinesses"
            
            response = requests.get(url, headers=headers, timeout=10)
            if response.status_code == 403:
                raise PermissionError("Permission denied. Ensure 'Bookings.Read.All' perm is granted.")
            response.raise_for_status()
            
            data = response.json()
            businesses = data.get("value", [])
            logger.info(f"Found {len(businesses)} booking business(es)")
            return businesses
            
        except Exception as e:
            logger.error(f"Error fetching booking businesses: {str(e)}")
            raise

    def get_booking_business_id(self) -> str:
        """Get the first booking business ID (or use cached one)"""
        if self.booking_business_id:
            return self.booking_business_id

        businesses = self.get_booking_businesses()
        if not businesses:
            raise ValueError("No booking businesses found.")

        # Use the first business
        self.booking_business_id = businesses[0]["id"]
        logger.info(f"Using booking business: {businesses[0].get('displayName')} ({self.booking_business_id})")
        return self.booking_business_id

    def get_appointments(self, start_date: Optional[str] = None, end_date: Optional[str] = None, status: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get all appointments within a date range"""
        try:
            headers = self._get_headers()
            
            # Default to PAST 30 days to FUTURE 60 days to catch "recent" bookings
            if not start_date:
                start_date = (datetime.utcnow() - timedelta(days=30)).strftime('%Y-%m-%dT%H:%M:%SZ')
            if not end_date:
                end_date = (datetime.utcnow() + timedelta(days=60)).strftime('%Y-%m-%dT%H:%M:%SZ')

            # Iterate over ALL booking businesses
            businesses = self.get_booking_businesses()
            
            all_appointments = []
            
            for business in businesses:
                try:
                    b_id = business["id"]
                    logger.info(f"Querying business: {business.get('displayName')} ({b_id})")
                    
                    url = f"https://graph.microsoft.com/v1.0/solutions/bookingBusinesses/{b_id}/calendarView"
                    params = {
                        "start": start_date,
                        "end": end_date
                    }
                    
                    # Add timeout
                    response = requests.get(url, headers=headers, params=params, timeout=15)
                    response.raise_for_status()
                    
                    data = response.json()
                    business_appointments = data.get("value", [])
                    logger.info(f"Found {len(business_appointments)} appointments in {business.get('displayName')}")
                    
                    all_appointments.extend(business_appointments)
                    
                except Exception as e:
                    logger.error(f"Error fetching from business {business.get('displayName')}: {str(e)}")
                    continue

            # Transform and Filter
            processed_appointments = []
            for apt in all_appointments:
                processed = self._map_appointment(apt)
                
                if status and processed["status"] != status:
                    continue
                
                processed_appointments.append(processed)
                
            return processed_appointments

        except Exception as e:
            logger.error(f"Error fetching appointments: {str(e)}")
            raise

    def get_appointment_by_id(self, appointment_id: str) -> Dict[str, Any]:
        """Get a specific appointment by ID"""
        try:
            business_id = self.get_booking_business_id()
            headers = self._get_headers()
            
            url = f"https://graph.microsoft.com/v1.0/solutions/bookingBusinesses/{business_id}/appointments/{appointment_id}"
            
            response = requests.get(url, headers=headers, timeout=10)
            response.raise_for_status()
            
            return self._map_appointment(response.json())
            
        except Exception as e:
            logger.error(f"Error fetching appointment {appointment_id}: {str(e)}")
            raise

    def _map_appointment(self, apt: Dict[str, Any]) -> Dict[str, Any]:
        """Map Microsoft Graph appointment to internal format"""
        customers = apt.get("customers", [])
        customer = customers[0] if customers else {}
        
        return {
            "id": apt.get("id"),
            "startDateTime": apt.get("startDateTime", {}).get("dateTime"),
            "endDateTime": apt.get("endDateTime", {}).get("dateTime"),
            "serviceId": apt.get("serviceId"),
            "serviceName": apt.get("serviceName", "Consultation"),
            "customerId": apt.get("customerId"),
            "customerName": customer.get("displayName", "Unknown"),
            "customerEmailAddress": customer.get("emailAddress", ""),
            "customerPhone": customer.get("phone", ""),
            "customerNotes": apt.get("customerNotes", "") or apt.get("additionalInformation", ""),
            # Handle status mapping if needed, currently passing through
            "status": apt.get("bookingStatus", "confirmed"), 
            "isLocationOnline": apt.get("isLocationOnline", True),
            "onlineMeetingUrl": apt.get("joinWebUrl"),
            "createdDateTime": apt.get("createdDateTime", datetime.now().isoformat())
        }

bookings_service = BookingsService()
