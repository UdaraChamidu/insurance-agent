import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Shield, Bell, Moon, Lock, LogOut, TrendingUp, Calendar, CheckCircle, Clock, Sun, Loader } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import bookingsService from '../services/bookingsService';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function ProfilePage() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [loading, setLoading] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [integrationStatus, setIntegrationStatus] = useState(null);
  const [integrationError, setIntegrationError] = useState('');
  const [stats, setStats] = useState([
    { label: 'Total Bookings', value: '0', icon: Calendar, color: 'blue' },
    { label: 'Completed', value: '0', icon: CheckCircle, color: 'green' },
    { label: 'Pending', value: '0', icon: Clock, color: 'yellow' },
    { label: 'Conversion Rate', value: '0%', icon: TrendingUp, color: 'purple' },
  ]);

  // Password State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordMessage, setPasswordMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    loadStats();
    loadIntegrationStatus();
  }, []);

  const loadStats = async () => {
    setLoading(true);
    try {
      const appointments = await bookingsService.getAppointments({});
      const now = new Date();
      
      const total = appointments.length;
      const completed = appointments.filter(a => new Date(a.startDateTime) < now).length;
      const pending = appointments.filter(a => new Date(a.startDateTime) >= now).length;
      const rate = total > 0 ? Math.round((completed / total) * 100) : 0;

      setStats([
        { label: 'Total Bookings', value: total.toString(), icon: Calendar, color: 'blue' },
        { label: 'Completed', value: completed.toString(), icon: CheckCircle, color: 'green' },
        { label: 'Upcoming', value: pending.toString(), icon: Clock, color: 'yellow' },
        { label: 'Completion Rate', value: `${rate}%`, icon: TrendingUp, color: 'purple' },
      ]);
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadIntegrationStatus = async () => {
    try {
      const res = await fetch(`${API_URL}/api/admin/settings`);
      if (!res.ok) {
        throw new Error(`Failed to load admin settings (${res.status})`);
      }
      const data = await res.json();
      setIntegrationStatus(data);
      setIntegrationError('');
    } catch (error) {
      console.error('Error loading integration status:', error);
      setIntegrationError(error.message || 'Failed to load API integration settings');
    }
  };

  const confirmLogout = () => {
      sessionStorage.removeItem('adminAuth');
      navigate('/'); 
  };

  const handlePasswordChange = (e) => {
    e.preventDefault();
    const storedPassword = localStorage.getItem('adminPassword') || 'admin123';
    
    if (currentPassword !== storedPassword) {
      setPasswordMessage({ type: 'error', text: 'Incorrect current password' });
      return;
    }

    if (newPassword.length < 6) {
      setPasswordMessage({ type: 'error', text: 'Password must be at least 6 characters' });
      return;
    }

    localStorage.setItem('adminPassword', newPassword);
    setPasswordMessage({ type: 'success', text: 'Password updated successfully' });
    setCurrentPassword('');
    setNewPassword('');
    
    // Clear success message after 3 seconds
    setTimeout(() => setPasswordMessage({ type: '', text: '' }), 3000);
  };

  const geminiUsage = integrationStatus?.geminiUsage;
  const geminiTotalTokens = geminiUsage?.sinceStart?.effectiveTokens ?? geminiUsage?.sinceStart?.totalTokens ?? 0;
  const geminiTodayTokens = geminiUsage?.today?.effectiveTokens ?? geminiUsage?.today?.totalTokens ?? 0;
  const geminiRequests = geminiUsage?.sinceStart?.requests || 0;
  const geminiErrors = geminiUsage?.sinceStart?.errors || 0;
  const geminiTokenSource = geminiUsage?.sinceStart?.tokenSource || 'none';
  const geminiReportedTotalTokens = geminiUsage?.sinceStart?.totalTokens || 0;
  const geminiEstimatedTotalTokens = geminiUsage?.sinceStart?.estimatedTokens || 0;
  const geminiEstimatedCost = geminiUsage?.utilization?.estimatedCostUsd;
  const geminiTotalLimitPct = geminiUsage?.utilization?.softTotalTokenLimitPct;
  const geminiDailyLimitPct = geminiUsage?.utilization?.softDailyTokenLimitPct;
  const geminiBudgetPct = geminiUsage?.utilization?.softBudgetPct;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Admin Profile</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Manage your account settings and preferences</p>
        </div>
        <button
          onClick={() => {
            loadStats();
            loadIntegrationStatus();
          }}
          disabled={loading}
          className="p-2 bg-blue-50 dark:bg-blue-600/10 hover:bg-blue-100 dark:hover:bg-blue-600/20 text-blue-600 dark:text-blue-400 rounded-lg transition-all flex items-center gap-2"
          title="Refresh Analytics & API Status"
        >
          <Loader className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
          <span className="hidden md:inline font-medium">Refresh Data</span>
        </button>
      </div>

      {/* Profile Card */}
      <div className="bg-white dark:bg-slate-800 backdrop-blur-md rounded-2xl border border-gray-200 dark:border-white/10 p-8 flex flex-col md:flex-row items-center md:items-start gap-6 shadow-sm transition-colors duration-300">
        <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg shadow-blue-500/20">
          <User className="h-12 w-12 text-white" />
        </div>
        <div className="flex-1 text-center md:text-left">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Admin User</h2>
          <p className="text-blue-600 dark:text-blue-300 flex items-center justify-center md:justify-start gap-2 mb-4">
            <Shield className="h-4 w-4" />
            Super Admin • Active
          </p>
          <p className="text-gray-600 dark:text-gray-400 max-w-2xl">
            Managing insurance consultations and client bookings.
          </p>
        </div>
        <button 
          onClick={() => setShowLogoutModal(true)}
          className="px-6 py-2 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/30 rounded-lg flex items-center gap-2 transition-all font-medium"
        >
          <LogOut className="h-4 w-4" />
          Logout
        </button>
      </div>

      {/* Analytics Grid */}
      <div>
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 px-1">Performance Overview</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat, index) => (
            <div key={index} className="bg-white dark:bg-slate-800 backdrop-blur-sm border border-gray-200 dark:border-white/10 rounded-xl p-6 hover:shadow-md transition-all">
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-lg ${theme === 'dark' ? `bg-${stat.color}-500/20` : `bg-${stat.color}-100`}`}>
                  <stat.icon className={`h-6 w-6 ${theme === 'dark' ? `text-${stat.color}-400` : `text-${stat.color}-600`}`} />
                </div>
                <span className="text-2xl font-bold text-gray-900 dark:text-white">{stat.value}</span>
              </div>
              <p className="text-gray-500 dark:text-gray-400 text-sm">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Settings Section */}
      <div className="grid md:grid-cols-2 gap-8">
        {/* Account Settings */}
        <div className="bg-white dark:bg-slate-800 backdrop-blur-md rounded-2xl border border-gray-200 dark:border-white/10 p-6 shadow-sm transition-colors duration-300">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
            <Lock className="h-5 w-5 text-blue-500 dark:text-blue-400" />
            Security Settings
          </h3>
          
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">Current Password</label>
              <input 
                type="password" 
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full bg-gray-50 dark:bg-slate-900/50 border border-gray-200 dark:border-white/10 rounded-lg px-4 py-2 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-colors" 
                placeholder="••••••••" 
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">New Password</label>
              <input 
                type="password" 
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full bg-gray-50 dark:bg-slate-900/50 border border-gray-200 dark:border-white/10 rounded-lg px-4 py-2 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-colors" 
                placeholder="••••••••" 
              />
            </div>
            
            {passwordMessage.text && (
              <div className={`text-sm p-2 rounded ${passwordMessage.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {passwordMessage.text}
              </div>
            )}

            <button className="w-full bg-blue-600 hover:bg-blue-700 dark:hover:bg-blue-500 text-white font-medium py-2 rounded-lg transition-colors mt-4 shadow-lg shadow-blue-500/20">
              Update Password
            </button>
          </form>
        </div>

        {/* Preferences */}
        <div className="bg-white dark:bg-slate-800 backdrop-blur-md rounded-2xl border border-gray-200 dark:border-white/10 p-6 shadow-sm transition-colors duration-300">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
            <User className="h-5 w-5 text-purple-500 dark:text-purple-400" />
            Preferences
          </h3>

          <div className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-900/50 rounded-xl transition-colors border border-gray-100 dark:border-white/5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-500/20 rounded-lg">
                  <Bell className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-gray-900 dark:text-white font-medium">Notifications</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Receive email alerts</p>
                </div>
              </div>
              <button 
                onClick={() => setNotifications(!notifications)}
                className={`w-12 h-6 rounded-full p-1 transition-colors ${notifications ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`}
              >
                <div className={`w-4 h-4 bg-white rounded-full transition-transform ${notifications ? 'translate-x-6' : 'translate-x-0'}`} />
              </button>
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-900/50 rounded-xl transition-colors border border-gray-100 dark:border-white/5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 dark:bg-purple-500/20 rounded-lg">
                  {theme === 'dark' ? (
                    <Moon className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  ) : (
                    <Sun className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  )}
                </div>
                <div>
                  <p className="text-gray-900 dark:text-white font-medium">Dark Mode</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Toggle theme</p>
                </div>
              </div>
              <button 
                onClick={toggleTheme}
                className={`w-12 h-6 rounded-full p-1 transition-colors ${theme === 'dark' ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`}
              >
                <div className={`w-4 h-4 bg-white rounded-full transition-transform ${theme === 'dark' ? 'translate-x-6' : 'translate-x-0'}`} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 backdrop-blur-md rounded-2xl border border-gray-200 dark:border-white/10 p-6 shadow-sm transition-colors duration-300">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Shield className="h-5 w-5 text-blue-500 dark:text-blue-400" />
          API Integrations
        </h3>
        {integrationError ? (
          <p className="text-sm text-red-500 dark:text-red-400">{integrationError}</p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <ProviderCard
                name="Gemini"
                configured={Boolean(integrationStatus?.providers?.gemini?.configured)}
                detail={integrationStatus?.providers?.gemini?.maskedKey || 'Not configured'}
              />
              <ProviderCard
                name="Pinecone"
                configured={Boolean(integrationStatus?.providers?.pinecone?.configured)}
                detail={
                  integrationStatus?.providers?.pinecone?.configured
                    ? `${integrationStatus?.providers?.pinecone?.maskedKey} | vectors: ${integrationStatus?.providers?.pinecone?.totalVectors || 0} | namespaces: ${integrationStatus?.providers?.pinecone?.namespaceCount || 0}`
                    : 'Not configured'
                }
              />
              <ProviderCard
                name="Deepgram"
                configured={Boolean(integrationStatus?.providers?.deepgram?.configured)}
                detail={
                  integrationStatus?.providers?.deepgram?.configured
                    ? `${integrationStatus?.providers?.deepgram?.maskedKey} | model: ${integrationStatus?.providers?.deepgram?.model || 'n/a'}`
                    : 'Not configured'
                }
              />
            </div>

            <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-slate-900/50 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-800 dark:text-white">Gemini Usage (Observed)</p>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {geminiUsage?.trackingMode === 'process_observed' ? 'Process Local' : 'Unknown'}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3">
                <MetricCard label="Total Tokens" value={formatNumber(geminiTotalTokens)} />
                <MetricCard label="Today Tokens" value={formatNumber(geminiTodayTokens)} />
                <MetricCard label="Requests" value={formatNumber(geminiRequests)} />
                <MetricCard label="Errors" value={formatNumber(geminiErrors)} />
              </div>

              <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2">
                <UsageRow label="Total Token Limit" pct={geminiTotalLimitPct} />
                <UsageRow label="Daily Token Limit" pct={geminiDailyLimitPct} />
                <UsageRow label="Budget Limit" pct={geminiBudgetPct} />
              </div>

              <div className="mt-3 text-xs text-gray-500 dark:text-gray-400 space-y-1">
                <p>Estimated Cost: {geminiEstimatedCost != null ? `$${geminiEstimatedCost}` : 'Not configured'}</p>
                <p>
                  Token Source:{' '}
                  {geminiTokenSource === 'api_reported'
                    ? 'API reported'
                    : geminiTokenSource === 'estimated'
                      ? 'Estimated fallback'
                      : 'No Gemini usage observed yet'}
                </p>
                <p>Reported Tokens: {formatNumber(geminiReportedTotalTokens)} | Estimated Tokens: {formatNumber(geminiEstimatedTotalTokens)}</p>
                <p>Today (UTC): {geminiUsage?.todayUtcDate || 'N/A'}</p>
                <p>{geminiUsage?.limitations || 'Usage tracking limitation details unavailable.'}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Logout Confirmation Modal */}
      {showLogoutModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-white/10 p-6 rounded-2xl shadow-2xl max-w-sm w-full transform transition-all scale-100">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Confirm Logout</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              Are you sure you want to end your session? You will need to login again to access the admin console.
            </p>
            <div className="flex space-x-3">
              <button 
                onClick={confirmLogout}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
              >
                Logout
              </button>
              <button 
                onClick={() => setShowLogoutModal(false)}
                className="flex-1 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-900 dark:text-gray-300 font-medium py-2 px-4 rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ProviderCard({ name, configured, detail }) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-slate-900/50 p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-800 dark:text-white">{name}</p>
        <span className={`text-xs px-2 py-0.5 rounded-full ${configured ? 'bg-emerald-500/15 text-emerald-500' : 'bg-red-500/15 text-red-500'}`}>
          {configured ? 'Configured' : 'Missing'}
        </span>
      </div>
      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 break-all">{detail}</p>
    </div>
  );
}

function MetricCard({ label, value }) {
  return (
    <div className="rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-slate-800/60 p-3">
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">{value}</p>
    </div>
  );
}

function UsageRow({ label, pct }) {
  const numeric = Number.isFinite(Number(pct)) ? Number(pct) : null;
  const clamped = numeric == null ? 0 : Math.min(100, Math.max(0, numeric));
  const color = numeric != null && numeric >= 90 ? 'bg-red-500' : numeric != null && numeric >= 70 ? 'bg-amber-500' : 'bg-emerald-500';

  return (
    <div className="rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-slate-800/60 p-2.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-600 dark:text-gray-300">{label}</span>
        <span className="font-semibold text-gray-800 dark:text-gray-100">{numeric == null ? 'N/A' : `${numeric.toFixed(1)}%`}</span>
      </div>
      <div className="mt-2 h-2 rounded-full bg-gray-200 dark:bg-slate-700 overflow-hidden">
        <div className={`h-2 ${color}`} style={{ width: `${clamped}%` }} />
      </div>
    </div>
  );
}

function formatNumber(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0';
  return n.toLocaleString();
}
