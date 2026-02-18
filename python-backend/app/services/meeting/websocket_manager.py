import json
from typing import Dict, List, Any, Optional
from fastapi import WebSocket

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

manager = ConnectionManager()
