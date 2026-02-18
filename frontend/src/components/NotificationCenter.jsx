import React, { useState, useRef, useEffect } from 'react';
import { Bell, Check, Trash2, X } from 'lucide-react';
import { useNotifications } from '../context/NotificationContext';

const NotificationCenter = () => {
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearAll } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getIconColor = (type) => {
      switch(type) {
          case 'lead': return 'bg-green-100 text-green-600';
          case 'booking': return 'bg-blue-100 text-blue-600';
          case 'file': return 'bg-purple-100 text-purple-600';
          default: return 'bg-gray-100 text-gray-600';
      }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Icon */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
      >
        <Bell className="w-6 h-6 text-gray-600 dark:text-gray-300" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center border-2 border-white dark:border-[#0f1014]">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-[#1a1b1e] rounded-xl shadow-2xl border border-gray-200 dark:border-white/10 overflow-hidden z-50">
          
          {/* Header */}
          <div className="p-4 border-b border-gray-100 dark:border-white/5 flex justify-between items-center bg-gray-50/50 dark:bg-white/5">
            <h3 className="font-semibold text-gray-900 dark:text-white">Notifications</h3>
            <div className="flex space-x-2">
                {unreadCount > 0 && (
                    <button 
                        onClick={markAllAsRead}
                        title="Mark all as read"
                        className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-white/10 text-gray-500 dark:text-gray-400"
                    >
                        <Check className="w-4 h-4" />
                    </button>
                )}
                <button 
                    onClick={clearAll}
                    title="Clear all"
                    className="p-1.5 rounded-lg hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-500/20 dark:text-gray-400 dark:hover:text-red-400 transition-colors"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-[400px] overflow-y-auto">
            {notifications.length === 0 ? (
                <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                    <Bell className="w-8 h-8 mx-auto mb-2 opacity-20" />
                    <p className="text-sm">No notifications yet</p>
                </div>
            ) : (
                notifications.map((notif) => (
                    <div 
                        key={notif.id}
                        className={`p-4 border-b border-gray-50 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors relative group ${!notif.isRead ? 'bg-blue-50/30 dark:bg-blue-500/5' : ''}`}
                    >
                        <div className="flex gap-3">
                            <div className={`w-2 h-2 mt-2 rounded-full ${!notif.isRead ? 'bg-blue-500' : 'bg-transparent'}`} />
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                    {notif.title}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 break-words">
                                    {notif.message}
                                </p>
                                <p className="text-[10px] text-gray-400 mt-1.5">
                                    {new Date(notif.createdAt).toLocaleString()}
                                </p>
                            </div>
                            {/* Individual Action */}
                            {!notif.isRead && (
                                <button 
                                    onClick={(e) => { e.stopPropagation(); markAsRead(notif.id); }}
                                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-200 dark:hover:bg-white/10 rounded-full transition-opacity self-start"
                                    title="Mark as read"
                                >
                                    <Check className="w-3 h-3 text-blue-500" />
                                </button>
                            )}
                        </div>
                    </div>
                ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationCenter;
