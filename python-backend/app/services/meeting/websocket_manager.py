import json
from typing import Dict, List, Any, Optional
from fastapi import WebSocket
import uuid

class ConnectionManager:
    def __init__(self):
        # meeting_id -> List[WebSocket]
        self.active_meetings: Dict[str, List[WebSocket]] = {}
        # connection_id -> {ws, user_id, meeting_id}
        self.connections: Dict[str, Dict[str, Any]] = {}

    async def connect(self, websocket: WebSocket, meeting_id: str, connection_id: str, user_id: Optional[str] = None, role: str = "customer"):
        await websocket.accept()
        
        if meeting_id not in self.active_meetings:
            self.active_meetings[meeting_id] = []
        
        self.active_meetings[meeting_id].append(websocket)
        
        self.connections[connection_id] = {
            "ws": websocket,
            "meeting_id": meeting_id,
            "user_id": user_id,
            "role": role
        }
        
        print(f"User {user_id or 'anon'} ({role}) connected to meeting {meeting_id}")

    def disconnect(self, connection_id: str):
        if connection_id in self.connections:
            conn_info = self.connections[connection_id]
            meeting_id = conn_info["meeting_id"]
            websocket = conn_info["ws"]
            
            if meeting_id in self.active_meetings:
                if websocket in self.active_meetings[meeting_id]:
                    self.active_meetings[meeting_id].remove(websocket)
                
                if not self.active_meetings[meeting_id]:
                    del self.active_meetings[meeting_id]
            
            del self.connections[connection_id]
            print(f"Connection {connection_id} disconnected")

    async def broadcast_to_meeting(self, meeting_id: str, message: dict, exclude: Optional[WebSocket] = None):
        if meeting_id in self.active_meetings:
            for connection in self.active_meetings[meeting_id]:
                if connection != exclude:
                    try:
                        await connection.send_json(message)
                    except Exception as e:
                        print(f"Error broadcasting to {meeting_id}: {e}")

    async def send_personal_message(self, message: dict, websocket: WebSocket):
        try:
            await websocket.send_json(message)
        except Exception as e:
            print(f"Error sending personal message: {e}")

    async def broadcast_to_admin(self, meeting_id: str, message: dict):
        """Broadcast message only to participants with role='admin'"""
        target_conns = [
            info for info in self.connections.values()
            if info["meeting_id"] == meeting_id and info.get("role") == "admin"
        ]
        
        for info in target_conns:
            try:
                await info["ws"].send_json(message)
            except Exception as e:
                print(f"Error broadcasting to admin: {e}")

    # --- Global Admin / Notification Support ---

    async def connect_admin_global(self, websocket: WebSocket):
        """
        Connect an admin to the global notification channel (no specific meeting)
        """
        await websocket.accept()
        connection_id = str(uuid.uuid4())
        
        # We use a special "global" meeting ID or just track separately
        # For simplicity, we'll store them in 'active_meetings["global_admin"]'
        # ensuring we don't conflict with real meetings (UUIDs)
        
        if "global_admin" not in self.active_meetings:
            self.active_meetings["global_admin"] = []
            
        self.active_meetings["global_admin"].append(websocket)
        self.connections[connection_id] = {
            "ws": websocket,
            "meeting_id": "global_admin",
            "user_id": "admin",
            "role": "admin"
        }
        print(f"Admin connected to global notification channel")

    async def broadcast_global(self, message: dict):
        """
        Broadcast to ALL connected global admins
        """
        if "global_admin" in self.active_meetings:
            for connection in self.active_meetings["global_admin"]:
                try:
                    await connection.send_json(message)
                except Exception as e:
                    print(f"Error broadcasting global: {e}")

manager = ConnectionManager()
