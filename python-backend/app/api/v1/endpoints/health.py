from fastapi import APIRouter
from app.services.meeting.audio_service import audio_service

router = APIRouter()

@router.get("/health")
def health_check():
    return {"status": "ok", "service": "insurance-ai-backend-python"}

@router.get("/health/latency")
def health_latency():
    return {
        "status": "ok",
        "service": "insurance-ai-backend-python",
        "latency": audio_service.get_latency_snapshot(),
    }
