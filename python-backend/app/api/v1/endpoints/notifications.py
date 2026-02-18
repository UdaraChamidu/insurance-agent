from typing import Any, Dict, List
from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from app.services.notification_service import notification_service
from app.services.meeting.websocket_manager import manager

router = APIRouter()

class MarkReadRequest(BaseModel):
    isRead: bool = True

@router.get("/", response_model=List[Dict[str, Any]])
async def get_notifications(limit: int = 50, unreadOnly: bool = False):
    """
    Get recent notifications
    """
    try:
        notifs = notification_service.get_notifications(limit=limit, unread_only=unreadOnly)
        return [
            {
                "id": n.id,
                "type": n.type,
                "title": n.title,
                "message": n.message,
                "isRead": n.isRead,
                "createdAt": n.createdAt,
                "metadata": n.metadata_json
            }
            for n in notifs
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.patch("/{notification_id}/read", response_model=Dict[str, Any])
async def mark_as_read(notification_id: str):
    """
    Mark a specific notification as read
    """
    try:
        n = notification_service.mark_as_read(notification_id)
        if not n:
            raise HTTPException(status_code=404, detail="Notification not found")
        return {"success": True, "id": n.id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/mark-all-read", response_model=Dict[str, Any])
async def mark_all_read():
    """
    Mark all notifications as read
    """
    try:
        notification_service.mark_all_as_read()
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/", response_model=Dict[str, Any])
async def clear_notifications():
    """
    Clear all notifications
    """
    try:
        notification_service.clear_all()
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# WebSocket endpoint for global notifications
@router.websocket("/ws")
async def websocket_notifications(websocket: WebSocket):
    try:
        await manager.connect_admin_global(websocket)
        while True:
            # Keep connection alive, maybe wait for a "ping" or just sleep
            # We don't expect much upstream data from admin here, mostly downstream
            data = await websocket.receive_text()
            # echo or ignore
    except WebSocketDisconnect:
        # manager cleanup handled in receive loop or explicitly if we tracked it better
        # For global_admin, we might need explicit cleanup in manager if not using the main loop logic
        if "global_admin" in manager.active_meetings and websocket in manager.active_meetings["global_admin"]:
            manager.active_meetings["global_admin"].remove(websocket)
    except Exception as e:
        print(f"Notification WS error: {e}")
