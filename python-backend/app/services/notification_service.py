from sqlalchemy.orm import Session
from app.models import Notification
from app.core.database import SessionLocal
from app.services.meeting.websocket_manager import manager
import uuid
from datetime import datetime

class NotificationService:
    def __init__(self):
        pass

    async def create_notification(self, type: str, title: str, message: str, metadata: dict = None):
        """
        Create a notification in DB and broadcast via WebSocket
        """
        db = SessionLocal()
        try:
            # 1. Save to DB
            notification = Notification(
                id=str(uuid.uuid4()),
                type=type,
                title=title,
                message=message,
                isRead=False,
                metadata_json=metadata or {},
                createdAt=datetime.utcnow()
            )
            db.add(notification)
            db.commit()
            db.refresh(notification)
            
            # 2. Broadcast
            payload = {
                "type": "notification",
                "notification": {
                    "id": notification.id,
                    "type": notification.type,
                    "title": notification.title,
                    "message": notification.message,
                    "isRead": notification.isRead,
                    "createdAt": notification.createdAt.isoformat(),
                    "metadata": notification.metadata_json
                }
            }
            await manager.broadcast_global(payload)
            
            return notification
        except Exception as e:
            print(f"Error creating notification: {e}")
            return None
        finally:
            db.close()

    def get_notifications(self, limit: int = 50, unread_only: bool = False):
        db = SessionLocal()
        try:
            query = db.query(Notification).order_by(Notification.createdAt.desc())
            
            if unread_only:
                query = query.filter(Notification.isRead == False)
                
            return query.limit(limit).all()
        finally:
            db.close()

    def mark_as_read(self, notification_id: str):
        db = SessionLocal()
        try:
            notification = db.query(Notification).filter(Notification.id == notification_id).first()
            if notification:
                notification.isRead = True
                db.commit()
                db.refresh(notification)
            return notification
        finally:
            db.close()

    def mark_all_as_read(self):
        db = SessionLocal()
        try:
            # Update all unread
            db.query(Notification).filter(Notification.isRead == False).update({Notification.isRead: True})
            db.commit()
            return True
        finally:
            db.close()
            
    def clear_all(self):
        db = SessionLocal()
        try:
            db.query(Notification).delete()
            db.commit()
            return True
        finally:
            db.close()

notification_service = NotificationService()
