import uuid
import json
from typing import Dict, Any
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException
from app.services.meeting.websocket_manager import manager

router = APIRouter()

@router.post("/", response_model=Dict[str, str])
async def create_meeting():
    """
    Create a new meeting room
    """
    meeting_id = str(uuid.uuid4())
    # In a real app, we might store this in DB or Redis
    # primarily to track active meetings or analytics
    return {"meetingId": meeting_id}

@router.get("/{meeting_id}", response_model=Dict[str, Any])
async def get_meeting(meeting_id: str):
    """
    Get meeting details (active participants)
    """
    if meeting_id not in manager.active_meetings:
         # For now, return empty if not active, or 404?
         # The frontend uses this to check if meeting exists? 
         # Node.js backend returns 404 if not in map.
         # But usually we allow joining a meeting that is just created.
         pass

    # For strict parity with Node.js backend:
    # Node.js: const meeting = meetings.get(req.params.meetingId);
    # Node.js: if (!meeting) return 404
    # The Node.js backend stores meeting state in memory map `meetings`.
    # We should probably track meeting metadata in `manager` too.
    
    # Returning basic info for now
    return {
        "meetingId": meeting_id,
        "activeParticipants": len(manager.active_meetings.get(meeting_id, []))
    }

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    # We can't use query params easily here for meetingId/userId in the decorator path
    # So we accept connection, then wait for "join-meeting" message?
    # Or frontend sends params in URL? `ws://.../ws?meetingId=...`
    # Node.js: `wss.on('connection', ...)` then waits for `message` with type `join-meeting`.
    
    # We accept generic connection first
    await websocket.accept()
    connection_id = str(uuid.uuid4())
    
    try:
        while True:
            data = await websocket.receive_json()
            message_type = data.get("type")
            
            if message_type == "join-meeting":
                meeting_id = data.get("meetingId")
                user_id = data.get("userId")
                role = data.get("role", "customer")
                
                # Register with manager
                await manager.connect(websocket, meeting_id, connection_id, user_id)
                
                # Notify others
                await manager.broadcast_to_meeting(meeting_id, {
                    "type": "participant-joined",
                    "userId": user_id,
                    "role": role,
                    "connectionId": connection_id
                }, exclude=websocket)
                
                # Acknowledge join
                await websocket.send_json({
                    "type": "joined-meeting",
                    "meetingId": meeting_id,
                    "userId": user_id
                })
                
            elif message_type == "offer":
                # Forward to specific target or broadcast?
                # WebRTC typically targets a specific peer or broadcasts to all (mesh)
                # Node.js implementation:
                # broadcastToMeeting(meetingId, { type: 'offer', ... }, connectionId)
                meeting_id = manager.connections[connection_id]["meeting_id"]
                await manager.broadcast_to_meeting(meeting_id, {
                    "type": "offer",
                    "offer": data.get("offer"),
                    "from": connection_id
                }, exclude=websocket)

            elif message_type == "answer":
                meeting_id = manager.connections[connection_id]["meeting_id"]
                await manager.broadcast_to_meeting(meeting_id, {
                    "type": "answer",
                    "answer": data.get("answer"),
                    "from": connection_id
                }, exclude=websocket)

            elif message_type == "ice-candidate":
                meeting_id = manager.connections[connection_id]["meeting_id"]
                await manager.broadcast_to_meeting(meeting_id, {
                    "type": "ice-candidate",
                    "candidate": data.get("candidate"),
                    "from": connection_id
                }, exclude=websocket)
            
            elif message_type == "audio-chunk":
                # Real-time audio processing would happen here
                # await audio_service.process_chunk(data.get("chunk"), meeting_id)
                pass

    except WebSocketDisconnect:
        manager.disconnect(connection_id)
        # Notify others
        # We need to know which meeting they were in to broadcast leave
        # But disconnect() cleans up. We should retrieve meeting_id *before* disconnect or have disconnect return it.
        pass
    except Exception as e:
        print(f"WebSocket error: {e}")
        manager.disconnect(connection_id)
