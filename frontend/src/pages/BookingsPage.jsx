import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import bookingsService from '../services/bookingsService';
import {
  Calendar, Clock, User, Mail, Phone, MapPin,
  Video, CheckCircle, XCircle, Loader, RefreshCw,
  ChevronDown, Search, Filter, ArrowRight, AlertCircle
} from 'lucide-react';

const STATUS_COLORS = {
  confirmed: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20', label: 'Confirmed' },
  pending:   { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20', label: 'Pending' },
  cancelled: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20', label: 'Cancelled' },
  completed: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20', label: 'Completed' },
  no_show:   { bg: 'bg-gray-500/10', text: 'text-gray-400', border: 'border-gray-500/20', label: 'No Show' },
};

export default function BookingsPage() {
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const filters = {};
      if (statusFilter) filters.status = statusFilter;
      const data = await bookingsService.getAppointments(filters);
      setAppointments(data);
    } catch (err) {
      setError('Failed to load appointments. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  const handleStatusChange = async (aptId, newStatus) => {
    try {
      await bookingsService.updateAppointment(aptId, { status: newStatus });
      fetchAppointments();
    } catch {
      setError('Failed to update appointment status.');
    }
  };

  const handleCancel = async (aptId) => {
    if (!window.confirm('Are you sure you want to cancel this appointment?')) return;
    try {
      await bookingsService.cancelAppointment(aptId);
      fetchAppointments();
    } catch {
      setError('Failed to cancel appointment.');
    }
  };

  const handleJoinMeeting = (meetingLink) => {
    if (meetingLink) navigate(meetingLink);
  };

  const filtered = appointments.filter(apt => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (apt.customerName || '').toLowerCase().includes(q) ||
      (apt.customerEmail || '').toLowerCase().includes(q) ||
      (apt.bookingRef || '').toLowerCase().includes(q) ||
      (apt.date || '').includes(q) ||
      (apt.serviceName || '').toLowerCase().includes(q)
    );
  });

  const upcoming = filtered.filter(a => a.status === 'confirmed' || a.status === 'pending').sort((a, b) => a.date.localeCompare(b.date));
  const past = filtered.filter(a => a.status === 'completed' || a.status === 'cancelled' || a.status === 'no_show');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Appointments</h1>
          <p className="text-gray-400 text-sm mt-1">{appointments.length} total appointments</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={fetchAppointments}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 text-gray-300 rounded-xl hover:bg-white/10 transition-all text-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, email, or date..."
            className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-gray-500 focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="pl-10 pr-10 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white appearance-none focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
          >
            <option value="" className="bg-slate-800">All Statuses</option>
            <option value="confirmed" className="bg-slate-800">Confirmed</option>
            <option value="pending" className="bg-slate-800">Pending</option>
            <option value="completed" className="bg-slate-800">Completed</option>
            <option value="cancelled" className="bg-slate-800">Cancelled</option>
            <option value="no_show" className="bg-slate-800">No Show</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl px-4 py-3 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader className="w-8 h-8 text-blue-400 animate-spin" />
        </div>
      ) : (
        <>
          {/* Upcoming Section */}
          {upcoming.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Upcoming ({upcoming.length})
              </h2>
              <div className="space-y-3">
                {upcoming.map(apt => (
                  <AppointmentCard
                    key={apt.id}
                    apt={apt}
                    expanded={expandedId === apt.id}
                    onToggle={() => setExpandedId(expandedId === apt.id ? null : apt.id)}
                    onStatusChange={handleStatusChange}
                    onCancel={handleCancel}
                    onJoin={handleJoinMeeting}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Past Section */}
          {past.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Past ({past.length})
              </h2>
              <div className="space-y-3">
                {past.map(apt => (
                  <AppointmentCard
                    key={apt.id}
                    apt={apt}
                    expanded={expandedId === apt.id}
                    onToggle={() => setExpandedId(expandedId === apt.id ? null : apt.id)}
                    onStatusChange={handleStatusChange}
                    onCancel={handleCancel}
                    onJoin={handleJoinMeeting}
                  />
                ))}
              </div>
            </div>
          )}

          {filtered.length === 0 && (
            <div className="text-center py-20">
              <Calendar className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400 text-lg">No appointments found</p>
              <p className="text-gray-500 text-sm mt-1">Appointments will appear here when leads book consultations.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function AppointmentCard({ apt, expanded, onToggle, onStatusChange, onCancel, onJoin }) {
  const status = STATUS_COLORS[apt.status] || STATUS_COLORS.pending;
  const isUpcoming = apt.status === 'confirmed' || apt.status === 'pending';

  return (
    <div className={`bg-white/5 border border-white/10 rounded-xl overflow-hidden transition-all hover:border-white/20`}>
      {/* Header Row */}
      <div
        className="flex items-center justify-between px-5 py-4 cursor-pointer"
        onClick={onToggle}
      >
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-10 h-10 bg-blue-600/20 rounded-xl flex items-center justify-center flex-shrink-0">
            <User className="w-5 h-5 text-blue-400" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-white font-medium truncate">{apt.customerName || 'Unknown'}</p>
              {apt.bookingRef && (
                <span className="px-2 py-0.5 bg-blue-600/20 text-blue-300 text-xs font-bold rounded">
                  {apt.bookingRef}
                </span>
              )}
            </div>
            <p className="text-gray-400 text-sm truncate">{apt.serviceName}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-white text-sm font-medium">
              {bookingsService.formatDate(apt.date)}
            </p>
            <p className="text-gray-400 text-sm">
              {bookingsService.formatTime(apt.startTime)} – {bookingsService.formatTime(apt.endTime)}
            </p>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${status.bg} ${status.text} border ${status.border}`}>
            {status.label}
          </span>
          <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="border-t border-white/5 px-5 py-4">
          <div className="grid md:grid-cols-3 gap-4 mb-4">
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="w-4 h-4 text-gray-500" />
              <span className="text-gray-400">Date:</span>
              <span className="text-white">{bookingsService.formatDate(apt.date)}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Clock className="w-4 h-4 text-gray-500" />
              <span className="text-gray-400">Time:</span>
              <span className="text-white">
                {bookingsService.formatTime(apt.startTime)} – {bookingsService.formatTime(apt.endTime)}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="w-4 h-4 text-gray-500" />
              <span className="text-gray-400">Timezone:</span>
              <span className="text-white">{apt.timezone}</span>
            </div>
            {apt.customerEmail && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="w-4 h-4 text-gray-500" />
                <span className="text-gray-400">Email:</span>
                <span className="text-white">{apt.customerEmail}</span>
              </div>
            )}
            {apt.customerPhone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="w-4 h-4 text-gray-500" />
                <span className="text-gray-400">Phone:</span>
                <span className="text-white">{apt.customerPhone}</span>
              </div>
            )}
          </div>

          {apt.notes && (
            <div className="text-sm text-gray-400 mb-4 bg-white/5 rounded-lg p-3">
              <span className="font-medium text-gray-300">Notes:</span> {apt.notes}
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            {isUpcoming && apt.meetingLink && (
              <button
                onClick={(e) => { e.stopPropagation(); onJoin(apt.meetingLink); }}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-all"
              >
                <Video className="w-4 h-4" />
                Join Meeting
              </button>
            )}
            {apt.status === 'confirmed' && (
              <button
                onClick={(e) => { e.stopPropagation(); onStatusChange(apt.id, 'completed'); }}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600/20 text-emerald-400 border border-emerald-500/20 rounded-lg text-sm font-medium hover:bg-emerald-600/30 transition-all"
              >
                <CheckCircle className="w-4 h-4" />
                Mark Complete
              </button>
            )}
            {apt.status === 'confirmed' && (
              <button
                onClick={(e) => { e.stopPropagation(); onStatusChange(apt.id, 'no_show'); }}
                className="flex items-center gap-2 px-4 py-2 bg-gray-600/20 text-gray-400 border border-gray-500/20 rounded-lg text-sm font-medium hover:bg-gray-600/30 transition-all"
              >
                No Show
              </button>
            )}
            {isUpcoming && (
              <button
                onClick={(e) => { e.stopPropagation(); onCancel(apt.id); }}
                className="flex items-center gap-2 px-4 py-2 bg-red-600/20 text-red-400 border border-red-500/20 rounded-lg text-sm font-medium hover:bg-red-600/30 transition-all"
              >
                <XCircle className="w-4 h-4" />
                Cancel
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
