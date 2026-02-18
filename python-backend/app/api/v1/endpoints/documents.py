from typing import Any, Dict, List
from fastapi import APIRouter, HTTPException, BackgroundTasks
from app.services.sharepoint_service import sharepoint_service
from app.services.document.ingestion_service import ingestion_service
from app.services.integrations.pinecone import pinecone_service
from pydantic import BaseModel

router = APIRouter()

class ReprocessRequest(BaseModel):
    fileKey: str

@router.get("/stats", response_model=Dict[str, Any])
async def get_document_stats():
    """
    Get statistics about the Knowledge Base (ingestion status + pinecone stats)
    """
    try:
        # 1. Get Ingestion Stats (from local tracker)
        ingestion_stat = ingestion_service.get_stats()
        
        # 2. Get Pinecone Stats (live)
        pinecone_stats = {"totalRecordCount": 0, "namespaces": {}}
        try:
             pinecone_stats = pinecone_service.get_stats()
        except Exception as e:
            print(f"Pinecone stats error: {e}")

        return {
            "ingestion": ingestion_stat,
            "pinecone": {
                "totalVectors": pinecone_stats.get("totalRecordCount", 0),
                "namespaces": pinecone_stats.get("namespaces", {})
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
