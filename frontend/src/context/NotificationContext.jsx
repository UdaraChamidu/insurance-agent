import React, { createContext, useContext, useState, useEffect, useRef } from 'react';

const NotificationContext = createContext();

export const useNotifications = () => useContext(NotificationContext);

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const ws = useRef(null);

  // Fetch initial notifications
  const fetchNotifications = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/notifications/?limit=50`);
      if (response.ok) {
        const data = await response.json();
        setNotifications(data);
        setUnreadCount(data.filter(n => !n.isRead).length);
      }
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    }
  };

  useEffect(() => {
    fetchNotifications();

    // Connect WebSocket
    const connectById = () => {
        // We use a specific endpoint for global notifications
        // The backend expects /api/v1/notifications/ws
        // But backend router prefix is /api/v1/notifications
        // So full path: ws://localhost:8000/api/v1/notifications/ws
        const wsUrl = `${import.meta.env.VITE_WS_URL || 'ws://localhost:8000'}/api/v1/notifications/ws`;
        
        ws.current = new WebSocket(wsUrl);

        ws.current.onopen = () => {
            console.log("Notification WS Connected");
            setIsConnected(true);
        };

        ws.current.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === "notification") {
                    const newNotif = data.notification;
                    setNotifications(prev => [newNotif, ...prev]);
                    setUnreadCount(prev => prev + 1);
                    
                    // Optional: Show toast here if you have a toast system
                }
            } catch (e) {
                console.error("WS Message Error:", e);
            }
        };

        ws.current.onclose = () => {
            console.log("Notification WS Disconnected");
            setIsConnected(false);
            // Reconnect after 5s
            setTimeout(connectById, 5000);
        };
    };

    connectById();

    return () => {
        if (ws.current) ws.current.close();
    };
  }, []);

  const markAsRead = async (id) => {
    try {
        await fetch(`${import.meta.env.VITE_API_URL}/api/v1/notifications/${id}/read`, {
            method: 'PATCH'
        });
        
        setNotifications(prev => prev.map(n => 
            n.id === id ? { ...n, isRead: true } : n
        ));
        setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
        console.error("Error marking read:", error);
    }
  };

  const markAllAsRead = async () => {
    try {
        await fetch(`${import.meta.env.VITE_API_URL}/api/v1/notifications/mark-all-read`, {
            method: 'POST'
        });
        
        setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
        setUnreadCount(0);
    } catch (error) {
        console.error("Error marking all read:", error);
    }
  };

  const clearAll = async () => {
      try {
        await fetch(`${import.meta.env.VITE_API_URL}/api/v1/notifications/`, {
            method: 'DELETE'
        });
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
        clearAll 
    }}>
      {children}
    </NotificationContext.Provider>
  );
};
