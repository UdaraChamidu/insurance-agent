import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { getApiBaseUrl } from '../utils/network';

const NotificationContext = createContext();
const API_URL = getApiBaseUrl();

export const useNotifications = () => useContext(NotificationContext);

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const ws = useRef(null);

  // Fetch initial notifications
  const fetchNotifications = async () => {
    try {
      const response = await fetch(`${API_URL}/api/v1/notifications/?limit=50`);
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
    // WebSocket disabled
  }, []);

  const markAsRead = async (id) => {
    try {
        await fetch(`${API_URL}/api/v1/notifications/${id}/read`, {
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
        await fetch(`${API_URL}/api/v1/notifications/mark-all-read`, {
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
        await fetch(`${API_URL}/api/v1/notifications/`, {
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
