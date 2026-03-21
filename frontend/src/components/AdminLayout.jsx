import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate, useLocation, Link } from 'react-router-dom';
import {
  Users,
  FileText,
  Settings,
  LogOut,
  Menu,
  X,
  Search,
  Calendar,
  Sun,
  Moon,
  Mail,
  BarChart3,
  Kanban,
  ShieldCheck
} from 'lucide-react';
import NotificationCenter from './NotificationCenter';
import { useTheme } from '../context/ThemeContext';

export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();

  const menuItems = [
    { path: '/admin/bookings', label: 'Appointments', icon: Calendar },
    { path: '/admin/leads', label: 'Clients', icon: Users },
    { path: '/admin/pipeline', label: 'Pipeline Board', icon: Kanban },
    { path: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
    { path: '/admin/documents', label: 'Knowledge Base', icon: FileText },
    { path: '/admin/templates', label: 'Templates', icon: Mail },
    { path: '/admin/compliance', label: 'Compliance', icon: ShieldCheck },
    { path: '/admin/profile', label: 'Settings', icon: Settings },
  ];

  const handleLogout = () => {
    sessionStorage.removeItem('adminAuth');
    navigate('/admin/login');
  };

  return (
    <div className="h-screen overflow-hidden bg-gray-100 dark:bg-slate-900 flex">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-30 w-64 bg-white dark:bg-slate-800 border-r border-gray-200 dark:border-white/10 transform transition-transform duration-200 ease-in-out lg:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="h-16 flex items-center px-6 border-b border-gray-200 dark:border-white/10">
          <Link
            to="/"
            className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent hover:opacity-80 transition-opacity"
            title="Go to public homepage"
          >
            Elite Deal Broker
          </Link>
          <button 
            className="ml-auto lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-6 w-6 text-gray-500" />
          </button>
        </div>

        <nav className="p-4 space-y-1">
          {menuItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) => `
                flex items-center space-x-3 px-4 py-3 rounded-xl transition-all
                ${isActive 
                  ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-medium' 
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white'
                }
              `}
            >
              <item.icon className="h-5 w-5" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="absolute bottom-4 left-4 right-4">
          <button 
            onClick={handleLogout}
            className="flex items-center space-x-3 px-4 py-3 rounded-xl text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 w-full transition-colors"
          >
            <LogOut className="h-5 w-5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden lg:ml-64 h-screen">
        {/* Top Header */}
        <header className="sticky top-0 z-20 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-white/10 h-16 flex items-center justify-between px-4 lg:px-8">
          <button 
            className="lg:hidden p-2 -ml-2 text-gray-600 dark:text-gray-300"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-6 w-6" />
          </button>

          <div className="flex-1 px-4 lg:px-8">
            <div className="max-w-md w-full relative hidden md:block">
              <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
              <input 
                type="text"
                placeholder="Search..."
                className="w-full pl-10 pr-4 py-2 bg-gray-100 dark:bg-slate-900/50 border border-transparent focus:border-blue-500 rounded-lg focus:outline-none dark:text-white transition-all"
              />
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <NotificationCenter />
            <button
              onClick={toggleTheme}
              className="h-8 w-8 rounded-full bg-gray-100 dark:bg-slate-900/60 border border-gray-200 dark:border-white/10 flex items-center justify-center text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-slate-800 transition-colors"
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <button
              onClick={() => navigate('/admin/profile')}
              className="h-8 w-8 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 flex items-center justify-center text-white font-bold hover:opacity-90 transition-opacity"
              title="Open profile settings"
              aria-label="Open profile"
            >
              A
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
