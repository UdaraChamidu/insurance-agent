import os
from typing import Any, Dict
from fastapi import APIRouter
from app.core.config import settings
from app.services.integrations.pinecone import pinecone_service
from app.services.llm.usage_tracker import gemini_usage_tracker

router = APIRouter()


def _mask_secret(secret: str) -> str:
    if not secret:
        return ""
    if len(secret) <= 8:
        return "*" * len(secret)
    return f"{secret[:4]}{'*' * (len(secret) - 8)}{secret[-4:]}"


def _coerce_int(value: Any) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return 0


def _extract_pinecone_counts(stats_obj: Any) -> Dict[str, int]:
    total = 0
    namespaces = 0
    if isinstance(stats_obj, dict):
        total = _coerce_int(
            stats_obj.get("totalRecordCount")
            or stats_obj.get("total_vector_count")
            or stats_obj.get("totalVectorCount")
            or stats_obj.get("totalVectors")
        )
        raw_ns = stats_obj.get("namespaces", {}) or {}
        if isinstance(raw_ns, dict):
            namespaces = len(raw_ns)
            if total <= 0:
                total = sum(
                    _coerce_int((v or {}).get("recordCount") if isinstance(v, dict) else None)
                    for v in raw_ns.values()
                )
    else:
        total = _coerce_int(
            getattr(stats_obj, "totalRecordCount", None)
            or getattr(stats_obj, "total_vector_count", None)
            or getattr(stats_obj, "totalVectorCount", None)
            or getattr(stats_obj, "totalVectors", None)
        )
        raw_ns = getattr(stats_obj, "namespaces", None)
        if isinstance(raw_ns, dict):
            namespaces = len(raw_ns)

    return {"totalVectors": max(0, total), "namespaceCount": max(0, namespaces)}


@router.get("/settings", response_model=Dict[str, Any])
def get_admin_settings():
    gemini_key = settings.GEMINI_API_KEY or ""
    pinecone_key = settings.PINECONE_API_KEY or ""
    deepgram_key = os.getenv("DEEPGRAM_API_KEY", "")
    pinecone_stats = {}
    try:
        pinecone_stats = _extract_pinecone_counts(pinecone_service.get_stats())
    except Exception:
        pinecone_stats = {"totalVectors": 0, "namespaceCount": 0}

    return {
        "success": True,
        "environment": settings.ENVIRONMENT,
        "geminiUsage": gemini_usage_tracker.get_snapshot(),
        "providers": {
            "gemini": {
                "configured": bool(gemini_key),
                "maskedKey": _mask_secret(gemini_key),
                "embeddingModel": "models/gemini-embedding-001",
            },
            "pinecone": {
                "configured": bool(pinecone_key),
                "maskedKey": _mask_secret(pinecone_key),
                "indexName": settings.PINECONE_INDEX_NAME,
                "totalVectors": pinecone_stats.get("totalVectors", 0),
                "namespaceCount": pinecone_stats.get("namespaceCount", 0),
            },
            "deepgram": {
                "configured": bool(deepgram_key),
                "maskedKey": _mask_secret(deepgram_key),
                "model": os.getenv("MEETING_DEEPGRAM_MODEL", "nova-3"),
                "streaming": os.getenv("MEETING_DEEPGRAM_STREAMING", "true").lower() in {"1", "true", "yes", "on"},
            },
        },
    }
