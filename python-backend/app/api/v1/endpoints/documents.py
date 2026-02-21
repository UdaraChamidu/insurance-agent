from typing import Any, Dict, List
from fastapi import APIRouter, HTTPException, BackgroundTasks
from app.services.sharepoint_service import sharepoint_service
from app.services.document.ingestion_service import ingestion_service
from app.services.integrations.pinecone import pinecone_service
from pydantic import BaseModel

router = APIRouter()

class ReprocessRequest(BaseModel):
    fileKey: str


def _coerce_int(value: Any, default: int = 0) -> int:
    try:
        if value is None:
            return default
        return int(value)
    except (TypeError, ValueError):
        return default


def _to_mapping(value: Any) -> Dict[str, Any]:
    if isinstance(value, dict):
        return value
    if hasattr(value, "model_dump"):
        try:
            dumped = value.model_dump()
            if isinstance(dumped, dict):
                return dumped
        except Exception:
            pass
    if hasattr(value, "to_dict"):
        try:
            dumped = value.to_dict()
            if isinstance(dumped, dict):
                return dumped
        except Exception:
            pass
    if hasattr(value, "__dict__"):
        data = {
            key: val
            for key, val in vars(value).items()
            if not str(key).startswith("_")
        }
        if isinstance(data, dict):
            return data
    return {}


def _extract_total_vectors(stats_obj: Any) -> int:
    if isinstance(stats_obj, dict):
        for key in ("totalVectors", "totalRecordCount", "total_vector_count", "totalVectorCount"):
            if key in stats_obj:
                return _coerce_int(stats_obj.get(key), 0)
    for attr in ("totalVectors", "totalRecordCount", "total_vector_count", "totalVectorCount"):
        if hasattr(stats_obj, attr):
            return _coerce_int(getattr(stats_obj, attr), 0)
    return 0


def _extract_namespaces(stats_obj: Any) -> Dict[str, Dict[str, int]]:
    raw_namespaces: Any = {}
    if isinstance(stats_obj, dict):
        raw_namespaces = stats_obj.get("namespaces", {}) or {}
    elif hasattr(stats_obj, "namespaces"):
        raw_namespaces = getattr(stats_obj, "namespaces") or {}

    if not isinstance(raw_namespaces, dict):
        raw_namespaces = _to_mapping(raw_namespaces)

    normalized: Dict[str, Dict[str, int]] = {}
    for ns_name, raw_data in (raw_namespaces or {}).items():
        namespace_name = str(ns_name or "")
        mapping = _to_mapping(raw_data)
        record_count = 0
        if mapping:
            for key in ("recordCount", "vector_count", "vectorCount", "totalRecordCount"):
                if key in mapping:
                    record_count = _coerce_int(mapping.get(key), 0)
                    break
        if record_count == 0 and not mapping:
            for attr in ("recordCount", "vector_count", "vectorCount", "totalRecordCount"):
                if hasattr(raw_data, attr):
                    record_count = _coerce_int(getattr(raw_data, attr), 0)
                    break
        normalized[namespace_name] = {"recordCount": record_count}
    return normalized

@router.get("/stats", response_model=Dict[str, Any])
async def get_document_stats():
    """
    Get statistics about the Knowledge Base (ingestion status + pinecone stats)
    """
    try:
        # 1. Get Ingestion Stats (from local tracker)
        ingestion_stat = ingestion_service.get_stats()
        
        # 2. Get Pinecone Stats (live) with schema normalization across SDK versions.
        pinecone_raw: Any = {"totalRecordCount": 0, "namespaces": {}}
        try:
            pinecone_raw = pinecone_service.get_stats()
        except Exception as e:
            print(f"Pinecone stats error: {e}")

        pinecone_namespaces = _extract_namespaces(pinecone_raw)
        pinecone_total = _extract_total_vectors(pinecone_raw)
        if pinecone_total <= 0 and pinecone_namespaces:
            pinecone_total = sum(
                _coerce_int(ns_data.get("recordCount"), 0)
                for ns_data in pinecone_namespaces.values()
            )

        return {
            "ingestion": ingestion_stat,
            "pinecone": {
                "totalVectors": pinecone_total,
                "namespaces": pinecone_namespaces
            }
        }
        
    except Exception as e:
        print(f"Stats Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/files", response_model=Dict[str, List[Dict[str, Any]]])
async def get_processed_files():
    """
    List all processed files
    """
    try:
        files = ingestion_service.get_processed_files()
        return {"files": files}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/reprocess", response_model=Dict[str, Any])
async def reprocess_file(request: ReprocessRequest):
    """
    Remove file from tracking so it gets picked up again by the ingester
    """
    try:
        removed_file = ingestion_service.reprocess_file(request.fileKey)
        if not removed_file:
            raise HTTPException(status_code=404, detail="File not found in tracking")
            
        # Trigger Notification
        from app.services.notification_service import notification_service
        # We can run this in background task if we inject it, but for now simple await or sync call if async allowed
        # notification_service is async for create_notification
        # We need to await it
        await notification_service.create_notification(
            type="file",
            title="File Reprocessing Started",
            message=f"Queueing {removed_file.get('fileName')} for re-ingestion",
            metadata={"fileKey": request.fileKey}
        )
            
        return {
             "success": True, 
             "fileName": removed_file.get("fileName"),
             "message": "File queued for re-processing"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/list", response_model=List[Dict[str, Any]])
async def list_documents(folder: str = "00_TrainingReference"):
    """
    List documents in a specific SharePoint folder (direct query)
    """
    try:
        return sharepoint_service.list_documents_in_folder(folder, "KB-DEV")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
