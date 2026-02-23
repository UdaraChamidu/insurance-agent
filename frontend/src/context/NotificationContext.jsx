import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { getApiBaseUrl, getWsBaseUrl } from '../utils/network';

const NotificationContext = createContext();
const API_URL = getApiBaseUrl();
const WS_BASE_URL = getWsBaseUrl();
const NOTIFICATION_WS_URL = `${WS_BASE_URL.replace(/\/$/, '')}/api/notifications/ws`;

export const useNotifications = () => useContext(NotificationContext);

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const ws = useRef(null);
  const reconnectTimer = useRef(null);

  const updateUnreadCount = (items) => {
    setUnreadCount(items.filter((n) => !n.isRead).length);
  };

  // Fetch initial notifications
  const fetchNotifications = async () => {
    try {
      const response = await fetch(`${API_URL}/api/notifications/?limit=50`);
      if (response.ok) {
        const data = await response.json();
        setNotifications(data);
        updateUnreadCount(data);
      }
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  useEffect(() => {
    let shouldReconnect = true;

    const connectWebSocket = () => {
      if (!shouldReconnect) return;
      try {
        const socket = new WebSocket(NOTIFICATION_WS_URL);
        ws.current = socket;

        socket.onopen = () => {
          setIsConnected(true);
        };

        socket.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data);
            if (payload?.type !== 'notification' || !payload.notification?.id) {
              return;
            }
            const incoming = payload.notification;
            setNotifications((prev) => {
              const existingIndex = prev.findIndex((n) => n.id === incoming.id);
              let next;
              if (existingIndex >= 0) {
                next = [...prev];
                next[existingIndex] = { ...next[existingIndex], ...incoming };
              } else {
                next = [incoming, ...prev];
              }
              updateUnreadCount(next);
              return next;
            });
          } catch (err) {
            console.error('Error parsing notification WS message:', err);
          }
        };

        socket.onerror = () => {
          socket.close();
        };

        socket.onclose = () => {
          setIsConnected(false);
          ws.current = null;
          if (shouldReconnect) {
            reconnectTimer.current = setTimeout(connectWebSocket, 3000);
          }
        };
      } catch (error) {
        console.error("Notification websocket connect failed:", error);
        if (shouldReconnect) {
          reconnectTimer.current = setTimeout(connectWebSocket, 3000);
        }
      }
    };

    connectWebSocket();

    return () => {
      shouldReconnect = false;
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
      }
      if (ws.current) {
        ws.current.close();
        ws.current = null;
      }
    };
  }, []);

  const markAsRead = async (id) => {
    try {
        const response = await fetch(`${API_URL}/api/notifications/${id}/read`, {
            method: 'PATCH'
        });
        if (!response.ok) return;
        
        setNotifications((prev) => {
            const next = prev.map((n) => (n.id === id ? { ...n, isRead: true } : n));
            updateUnreadCount(next);
            return next;
        });
    } catch (error) {
        console.error("Error marking read:", error);
    }
  };

  const markAllAsRead = async () => {
    try {
        const response = await fetch(`${API_URL}/api/notifications/mark-all-read`, {
            method: 'POST'
        });
        if (!response.ok) return;
        
        setNotifications((prev) => {
            const next = prev.map((n) => ({ ...n, isRead: true }));
            updateUnreadCount(next);
            return next;
        });
    } catch (error) {
        console.error("Error marking all read:", error);
    }
  };

  const deleteOneRead = async (id) => {
    try {
      const response = await fetch(`${API_URL}/api/notifications/${id}?readOnly=true`, {
        method: 'DELETE'
      });
      if (!response.ok) return;

      setNotifications((prev) => {
        const next = prev.filter((n) => n.id !== id);
        updateUnreadCount(next);
        return next;
      });
    } catch (error) {
      console.error("Error deleting read notification:", error);
    }
  };

  const deleteReadAll = async () => {
    try {
      const response = await fetch(`${API_URL}/api/notifications/read`, {
        method: 'DELETE'
      });
      if (!response.ok) return;

      setNotifications((prev) => {
        const next = prev.filter((n) => !n.isRead);
        updateUnreadCount(next);
        return next;
      });
    } catch (error) {
      console.error("Error deleting read notifications:", error);
    }
  };

  const clearAll = async () => {
      try {
        const response = await fetch(`${API_URL}/api/notifications/`, {
            method: 'DELETE'
        });
        if (!response.ok) return;
        setNotifications([]);
        setUnreadCount(0);
      } catch (error) {
          console.error("Error clearing notifications:", error);
      }
  };

  return (
    <NotificationContext.Provider value={{ 
        notifications, 
        unreadCount, 
        isConnected, 
        markAsRead, 
        markAllAsRead,
        deleteOneRead,
        deleteReadAll,
        clearAll 
    }}>
      {children}
    </NotificationContext.Provider>
  );
};
