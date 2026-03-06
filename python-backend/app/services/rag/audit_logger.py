import json
import os
from datetime import datetime, timezone
from typing import Any, Dict


class RAGAuditLogger:
    def __init__(self, log_file: str = "assist_audit_log.jsonl"):
        self.log_file = log_file

    def _sanitize(self, value: Any) -> Any:
        if value is None:
            return None
        if isinstance(value, (str, int, float, bool)):
            return value
        if isinstance(value, list):
            return [self._sanitize(item) for item in value]
        if isinstance(value, dict):
            return {str(key): self._sanitize(val) for key, val in value.items()}
        return str(value)

    def log_event(self, payload: Dict[str, Any]) -> None:
        event = self._sanitize(payload) if isinstance(payload, dict) else {"payload": str(payload)}
        event["timestamp"] = datetime.now(timezone.utc).isoformat()
        line = json.dumps(event, ensure_ascii=False)

        try:
            directory = os.path.dirname(self.log_file)
            if directory:
                os.makedirs(directory, exist_ok=True)
            with open(self.log_file, "a", encoding="utf-8") as file_obj:
                file_obj.write(line + "\n")
        except Exception as log_error:
            print(f"RAG audit log write failed: {log_error}")


rag_audit_logger = RAGAuditLogger()

