import asyncio
import logging
from datetime import datetime, timedelta
from typing import List

from app.services.sharepoint_service import sharepoint_service
from app.services.document.ingestion_service import ingestion_service
from app.services.rag.orchestrator import ingestion_orchestrator

logger = logging.getLogger(__name__)

class DocumentPoller:
    def __init__(self):
        self.is_running = False
        self._task = None

    async def start(self):
        if self.is_running:
            return
        self.is_running = True
        logger.info("Starting Document Poller...")
        self._task = asyncio.create_task(self._poll_loop())

    async def stop(self):
        self.is_running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("Document Poller stopped.")

    async def _poll_loop(self):
        while self.is_running:
            try:
                # Update stats
                ingestion_service.state["isRunning"] = True
                ingestion_service.state["lastCheck"] = datetime.utcnow().isoformat()
                ingestion_service._save_state()

                await self._check_sharepoint()
                
                # Check again in X minutes
                interval = ingestion_service.state.get("pollingIntervalMinutes", 5)
                # Sleep in chunks to allow cancellation
                for _ in range(int(interval * 60 / 5)): 
                    if not self.is_running: break
                    await asyncio.sleep(5)
                    
            except Exception as e:
                logger.error(f"Error in poll loop: {e}")
                # Wait a bit before retrying on error
                await asyncio.sleep(60)

    async def _check_sharepoint(self):
        logger.info("Checking SharePoint for updates...")
        
        folders = sharepoint_service.folders # configured list
        
        for folder_info in folders:
            folder_name = folder_info["name"]
            namespace = folder_info["universe"]
            
            try:
                # 1. List files in folder
                files = sharepoint_service.list_documents_in_folder(folder_name)
                
                for file in files:
                    await self._process_file_if_needed(file, folder_name, namespace)
                    
            except Exception as e:
                logger.error(f"Failed to poll folder {folder_name}: {e}")
        
        # Update check count
        ingestion_service.state["totalChecks"] = ingestion_service.state.get("totalChecks", 0) + 1
        ingestion_service._save_state()

    async def _process_file_if_needed(self, file_info: dict, folder_name: str, namespace: str):
        file_id = file_info["id"]
        file_name = file_info["name"]
        last_modified = file_info["lastModified"]
        
        # Unique key for tracking: id is good, or path
        # Using ID is safest
        
        processed_files = ingestion_service.get_processed_files()
        existing = next((f for f in processed_files if f["key"] == file_id), None)
        
        should_process = False
        
        if not existing:
            logger.info(f"New file detected: {file_name}")
            should_process = True
        else:
            # Check modification time OR error status
            if existing.get("lastModified") != last_modified:
                logger.info(f"File modified: {file_name}")
                should_process = True
            elif existing.get("status") == "error":
                logger.info(f"Retrying failed file: {file_name}")
                should_process = True
        
        if should_process:
            try:
                # Mark file as actively processing so UI can show live progress state.
                ingestion_service.add_processed_file({
                    "key": file_id,
                    "fileName": file_name,
                    "namespace": namespace,
                    "status": "processing",
                    "lastModified": last_modified,
                    "processedAt": datetime.utcnow().isoformat(),
                    "chunks": 0,
                    "vectors": 0,
                })

                # 1. Download
                logger.info(f"Downloading {file_name}...")
                content = sharepoint_service.download_document(
                    file_info.get("downloadUrl"), 
                    file_info.get("driveId"), 
                    file_id
                )
                
                # 2. Ingest
                chunks_count, vectors_count = await ingestion_orchestrator.process_file_content(content, file_name, folder_name, namespace)
                
                # 3. Update State
                status = "success" if (vectors_count or 0) > 0 else "no_vectors"
                ingestion_service.add_processed_file({
                    "key": file_id,
                    "fileName": file_name,
                    "namespace": namespace,
                    "status": status,
                    "lastModified": last_modified,
                    "processedAt": datetime.utcnow().isoformat(),
                    "chunks": chunks_count,
                    "vectors": vectors_count
                })
                
                # Trigger Notification
                from app.services.notification_service import notification_service
                await notification_service.create_notification(
                    type="file",
                    title="Document Ingested",
                    message=f"Successfully processed {file_name}",
                    metadata={"fileId": file_id}
                )

            except Exception as e:
                logger.error(f"Error processing {file_name}: {e}")
                ingestion_service.add_processed_file({
                    "key": file_id,
                    "fileName": file_name,
                    "namespace": namespace,
                    "status": "error",
                    "error": str(e),
                    "lastModified": last_modified,
                    "processedAt": datetime.utcnow().isoformat()
                })

document_poller = DocumentPoller()
