import uuid
from typing import Dict, Any
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.services.meeting.websocket_manager import manager

from app.services.meeting.audio_service import audio_service

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
    participants = manager.get_participants(meeting_id)
    return {
        "meetingId": meeting_id,
        "activeParticipants": len(participants),
        "participants": participants,
    }

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    connection_id = str(uuid.uuid4())
    meeting_id = None
    user_id = None
    role = "customer"

    async def _forward_signal(message_type: str, data: Dict[str, Any]):
        signal = data.get("signal")
        if not signal:
            await websocket.send_json({
                "type": "error",
                "message": f"{message_type} missing signal payload",
            })
            return

        payload = {
            "type": message_type,
            "signal": signal,
            "fromUserId": user_id,
            "fromConnectionId": connection_id,
        }

        target_user_id = data.get("targetUserId")
        if target_user_id:
            delivered = await manager.send_to_user(meeting_id, target_user_id, payload)
            if delivered:
                return

        await manager.broadcast_to_meeting(meeting_id, payload, exclude=websocket)
    
    try:
        while True:
            data = await websocket.receive_json()
            message_type = data.get("type")
            
            if message_type == "join-meeting":
                meeting_id = data.get("meetingId")
                user_id = data.get("userId") or f"anon-{connection_id[:8]}"
                role = data.get("role", "customer")

                if not meeting_id:
                    await websocket.send_json({
                        "type": "error",
                        "message": "meetingId is required",
                    })
                    continue
                
                # Register with manager
                await manager.connect(websocket, meeting_id, connection_id, user_id, role)
                participants = manager.get_participants(meeting_id)
                
                # Acknowledge join
                await websocket.send_json({
                    "type": "joined-meeting",
                    "meetingId": meeting_id,
                    "userId": user_id,
                    "role": role,
                    "participants": participants,
                })

                # Notify others
                await manager.broadcast_to_meeting(meeting_id, {
                    "type": "participant-joined",
                    "userId": user_id,
                    "role": role,
                    "connectionId": connection_id,
                    "participants": participants,
                }, exclude=websocket)

            elif message_type == "offer":
                if not meeting_id:
                    await websocket.send_json({"type": "error", "message": "join-meeting required before offer"})
                    continue
                await _forward_signal("offer", data)

            elif message_type == "answer":
                if not meeting_id:
                    await websocket.send_json({"type": "error", "message": "join-meeting required before answer"})
                    continue
                await _forward_signal("answer", data)

            elif message_type == "ice-candidate":
                if not meeting_id:
                    await websocket.send_json({"type": "error", "message": "join-meeting required before ice-candidate"})
                    continue
                await _forward_signal("ice-candidate", data)
            
            elif message_type == "audio-chunk":
                # Real-time audio processing
                current_meeting_id = meeting_id or data.get("meetingId")
                current_user_id = data.get("userId") or user_id
                audio_data = data.get("audioData")
                raw_sample_rate = data.get("sampleRate")
                raw_client_sent_at = data.get("clientSentAtMs")
                try:
                    sample_rate = int(raw_sample_rate) if raw_sample_rate is not None else None
                except (TypeError, ValueError):
                    sample_rate = None
                try:
                    client_sent_at_ms = int(raw_client_sent_at) if raw_client_sent_at is not None else None
                except (TypeError, ValueError):
                    client_sent_at_ms = None
                if current_meeting_id and current_user_id and audio_data:
                    await audio_service.process_audio_chunk(
                        current_meeting_id,
                        current_user_id,
                        audio_data,
                        sample_rate=sample_rate,
                        client_sent_at_ms=client_sent_at_ms,
                    )

            elif message_type == "request-ai-suggestion":
                current_meeting_id = meeting_id or data.get("meetingId")
                request_user_id = data.get("userId") or user_id or "customer"
                text = data.get("text")
                metadata = data.get("metadata") if isinstance(data.get("metadata"), dict) else {}
                if current_meeting_id and text:
                    # Non-blocking AI generation keeps websocket receive loop responsive.
                    audio_service.enqueue_ai_suggestion(
                        current_meeting_id,
                        request_user_id,
                        text,
                        metadata=metadata,
                    )

            elif message_type == "leave-meeting":
                if meeting_id and user_id:
                    audio_service.clear_user_state(meeting_id, user_id)
                break

    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"WebSocket error: {e}")
    finally:
        conn_info = manager.disconnect(connection_id)
        if conn_info:
            left_meeting_id = conn_info.get("meeting_id")
            left_user_id = conn_info.get("user_id")
            left_role = conn_info.get("role", "customer")
            if left_meeting_id and left_user_id:
                audio_service.clear_user_state(left_meeting_id, left_user_id)
                await manager.broadcast_to_meeting(left_meeting_id, {
                    "type": "participant-left",
                    "userId": left_user_id,
                    "role": left_role,
                    "connectionId": connection_id,
                    "participants": manager.get_participants(left_meeting_id),
                })
