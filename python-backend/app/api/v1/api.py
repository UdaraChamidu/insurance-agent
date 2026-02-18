from fastapi import APIRouter
from app.api.v1.endpoints import (
    leads,
    meetings,
    documents,
    bookings,
    health,
    notifications
)

api_router = APIRouter()

api_router.include_router(health.router, tags=["health"])
api_router.include_router(leads.router, prefix="/leads", tags=["leads"])
api_router.include_router(meetings.router, prefix="/meetings", tags=["meetings"])
api_router.include_router(documents.router, prefix="/documents", tags=["documents"])
api_router.include_router(bookings.router, prefix="/bookings", tags=["bookings"])
api_router.include_router(notifications.router, prefix="/notifications", tags=["notifications"])
