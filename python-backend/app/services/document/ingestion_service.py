import json
import os
from datetime import datetime
from typing import Dict, List, Any, Optional

class IngestionService:
    def __init__(self, storage_file: str = "ingestion_state.json"):
        self.storage_file = storage_file
        self.state = self._load_state()

    def _load_state(self) -> Dict[str, Any]:
        if os.path.exists(self.storage_file):
            try:
                with open(self.storage_file, "r") as f:
                    return json.load(f)
            except Exception as e:
                print(f"Error loading ingestion state: {e}")
        
        # Default state
        return {
            "isRunning": True,
            "processedFileCount": 0,
            "totalChecks": 0,
            "lastCheck": datetime.utcnow().isoformat(),
            "pollingIntervalMinutes": 5,
            "files": []  # List of { key, fileName, namespace, status, chunks, vectors, processedAt }
        }

    def _save_state(self):
        try:
            # Update last check time on save? Or separate method?
            with open(self.storage_file, "w") as f:
                json.dump(self.state, f, indent=2)
        except Exception as e:
            print(f"Error saving ingestion state: {e}")

    def get_stats(self) -> Dict[str, Any]:
        files = self.get_processed_files()
        errors = []
        processing_files = []
        success_count = 0
        no_vectors_count = 0
        error_count = 0

        for file_entry in files:
            status = file_entry.get("status")
            if status == "processing":
                processing_files.append({
                    "key": file_entry.get("key"),
                    "fileName": file_entry.get("fileName"),
                    "namespace": file_entry.get("namespace"),
                    "startedAt": file_entry.get("processedAt"),
                })
            elif status == "success":
                success_count += 1
            elif status == "no_vectors":
                no_vectors_count += 1
            elif status == "error":
                error_count += 1
                errors.append({
                    "file": file_entry.get("fileName"),
                    "error": file_entry.get("error", "Unknown ingestion error"),
                    "timestamp": file_entry.get("processedAt"),
                })

        return {
            "isRunning": self.state.get("isRunning", True),
            "processedFileCount": len(files),
            "processingFileCount": len(processing_files),
            "successFileCount": success_count,
            "noVectorsFileCount": no_vectors_count,
            "errorFileCount": error_count,
            "totalChecks": self.state.get("totalChecks", 0),
            "lastCheck": self.state.get("lastCheck", datetime.utcnow().isoformat()),
            "pollingIntervalMinutes": self.state.get("pollingIntervalMinutes", 5),
            "processingFiles": processing_files,
            "errors": errors[-25:],
        }

    def get_processed_files(self) -> List[Dict[str, Any]]:
        files = self.state.get("files", [])
        normalized_files: List[Dict[str, Any]] = []
        for file_entry in files:
            normalized = dict(file_entry)
            vectors = normalized.get("vectors", 0)
            try:
                vectors_count = int(vectors)
            except (TypeError, ValueError):
                vectors_count = 0

            # If a file produced zero vectors, surface the operational state clearly.
            if normalized.get("status") == "success" and vectors_count <= 0:
                normalized["status"] = "no_vectors"

            if normalized.get("status") in {"success", "no_vectors"}:
                normalized.pop("error", None)

            normalized_files.append(normalized)

        return normalized_files

    def add_processed_file(self, file_data: Dict[str, Any]):
        """
        Add or update a processed file record
        """
        files = self.state.get("files", [])
        
        # Check if exists
        existing_idx = next((i for i, f in enumerate(files) if f["key"] == file_data["key"]), -1)
        
        if existing_idx >= 0:
            merged = {**files[existing_idx], **file_data}
            # Avoid stale error message after a successful re-ingest.
            if merged.get("status") in {"success", "no_vectors"}:
                merged.pop("error", None)
            files[existing_idx] = merged
        else:
            new_entry = dict(file_data)
            if new_entry.get("status") in {"success", "no_vectors"}:
                new_entry.pop("error", None)
            files.append(new_entry)
            
        self.state["files"] = files
        self.state["processedFileCount"] = len(files)
        self._save_state()

    def reprocess_file(self, file_key: str) -> Optional[Dict[str, Any]]:
        """
        Remove file from tracking so it gets picked up again by the ingester
        """
        files = self.state.get("files", [])
        file_to_remove = next((f for f in files if f["key"] == file_key), None)
        
        if file_to_remove:
            self.state["files"] = [f for f in files if f["key"] != file_key]
            self.state["processedFileCount"] = len(self.state["files"])
            self._save_state()
            return file_to_remove
            
        return None

# Singleton instance
ingestion_service = IngestionService()
