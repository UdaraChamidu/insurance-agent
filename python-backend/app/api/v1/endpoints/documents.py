from typing import Any, Dict, List
from fastapi import APIRouter, HTTPException
from app.services.sharepoint_service import sharepoint_service

router = APIRouter()

@router.get("/stats", response_model=Dict[str, Any])
async def get_document_stats():
    """
    Get statistics about the Knowledge Base (folders, file counts)
    """
    try:
        folders = sharepoint_service.list_folders("KB-DEV")
        
        # This might be slow if we iterate all folders.
        # For now, let's just return folder count and maybe top-level info.
        # Or do we strictly need total files?
        # The frontend likely expects: { totalFiles: number, totalSize: string, ... }
        # Let's check what nodejs implementation did if possible, or just improve gradually.
        # Node.js `sharepoint-service.js` had `syncAllFolders`.
        
        total_files = 0
        total_size = 0
        
        # We can try to get stats from folder metadata if available, 
        # or we might need to crawl. Crawling is slow for a "stats" endpoint.
        # Let's approximate or just count folders for now, 
        # OR if performance is okay, we list files in each folder.
        # Given we have 7 folders, it might be okay-ish.
        
        # Let's do a lightweight version: counts based on folder size if prop exists?
        # Graph API folder "size" includes children? Yes usually.
        
        for folder in folders:
            # item['size'] should exist
            total_size += folder.get("size", 0)
            # folder['folder']['childCount'] might exist
            total_files += folder.get("folder", {}).get("childCount", 0)

        # Convert bytes to MB/GB
        size_str = f"{total_size / (1024*1024):.1f} MB"
        
        return {
            "totalFiles": total_files,
            "totalFolders": len(folders),
            "totalSize": size_str,
            "universes": [f["name"] for f in folders]
        }
        
    except Exception as e:
        # Fallback if connection fails
        print(f"Stats Error: {e}")
        return {
            "totalFiles": 0,
            "totalFolders": 0,
            "totalSize": "0 MB",
            "universes": []
        }

@router.get("/list", response_model=List[Dict[str, Any]])
async def list_documents(folder: str = "00_TrainingReference"):
    """
    List documents in a specific folder
    """
    try:
        return sharepoint_service.list_documents_in_folder(folder, "KB-DEV")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
