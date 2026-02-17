from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, Query
from app.services.bookings_service import bookings_service

router = APIRouter()

@router.get("/appointments", response_model=List[Dict[str, Any]])
async def get_appointments(
    start: Optional[str] = Query(None, description="Start date (ISO8601)"),
    end: Optional[str] = Query(None, description="End date (ISO8601)"),
    status: Optional[str] = Query(None, description="Filter by status")
):
    """
    Get appointments from Microsoft Bookings
    """
    try:
        return bookings_service.get_appointments(start_date=start, end_date=end, status=status)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/business", response_model=Dict[str, Any])
async def get_business_info():
    """
    Get booking business information
    """
    try:
        # We need to expose this in service first, but for now we can get ID
        # The service has get_booking_businesses, let's just use the first one details
        # Or I can add get_business_info to service. 
        # Check service... it has get_booking_business_id. 
        # I should probably add a get_business_details method to service if needed later.
        # For now, the user error was about appointments.
        pass 
        return {"message": "Not implemented yet"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
