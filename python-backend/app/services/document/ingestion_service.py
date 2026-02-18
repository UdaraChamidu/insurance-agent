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
        return {
            "isRunning": self.state.get("isRunning", True),
            "processedFileCount": len(self.state.get("files", [])),
            "totalChecks": self.state.get("totalChecks", 0),
            "lastCheck": self.state.get("lastCheck", datetime.utcnow().isoformat()),
            "pollingIntervalMinutes": self.state.get("pollingIntervalMinutes", 5),
            "errors": [] # Placeholder for now
        }

    def get_processed_files(self) -> List[Dict[str, Any]]:
        return self.state.get("files", [])

    def add_processed_file(self, file_data: Dict[str, Any]):
        """
        Add or update a processed file record
        """
        files = self.state.get("files", [])
        
        # Check if exists
        existing_idx = next((i for i, f in enumerate(files) if f["key"] == file_data["key"]), -1)
        
        if existing_idx >= 0:
            files[existing_idx] = {**files[existing_idx], **file_data}
        else:
            files.append(file_data)
            
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
