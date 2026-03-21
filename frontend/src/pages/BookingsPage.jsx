import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import bookingsService from '../services/bookingsService';
import {
  Calendar, Clock, User, Mail, Phone, MapPin,
  Video, CheckCircle, XCircle, Loader, RefreshCw,
  ChevronDown, Search, ArrowRight, AlertCircle, Trash2
} from 'lucide-react';
import DeleteConfirmModal from '../components/DeleteConfirmModal';

const STATUS_COLORS = {
  confirmed: { bg: 'bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-500/20', label: 'Confirmed' },
  pending:   { bg: 'bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-500/20', label: 'Pending' },
  past_due:  { bg: 'bg-orange-500/10', text: 'text-orange-600 dark:text-orange-400', border: 'border-orange-500/20', label: 'Past Due' },
  incomplete:{ bg: 'bg-yellow-500/10', text: 'text-yellow-600 dark:text-yellow-300', border: 'border-yellow-500/20', label: 'Incomplete' },
  cancelled: { bg: 'bg-red-500/10', text: 'text-red-600 dark:text-red-400', border: 'border-red-500/20', label: 'Cancelled' },
  completed: { bg: 'bg-blue-500/10', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-500/20', label: 'Completed' },
  no_show:   { bg: 'bg-gray-500/10', text: 'text-gray-600 dark:text-gray-400', border: 'border-gray-500/20', label: 'No Show' },
};

const STATUS_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'pending', label: 'Pending' },
  { key: 'past_due', label: 'Past Due' },
  { key: 'incomplete', label: 'Incomplete' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'no_show', label: 'No Show' },
];

const KNOWN_BASE_STATUSES = new Set(['confirmed', 'pending', 'completed', 'cancelled', 'no_show']);
const isPastAppointmentSlot = (appointment) => {
  const datePart = String(appointment?.date || '').trim();
  if (!datePart) return false;
  const startPart = String(appointment?.startTime || '00:00').trim() || '00:00';
  const dt = new Date(`${datePart}T${startPart}:00`);
  if (Number.isNaN(dt.getTime())) return false;
  return dt.getTime() < Date.now();
};

const deriveStatus = (appointment) => {
  const baseStatus = String(appointment?.status || '').trim().toLowerCase();
  if (!KNOWN_BASE_STATUSES.has(baseStatus)) {
    return 'incomplete';
  }

  if ((baseStatus === 'confirmed' || baseStatus === 'pending') && isPastAppointmentSlot(appointment)) {
    return 'past_due';
  }

  return baseStatus;
};

// simple cache to avoid blank state on navigation
let appointmentsCache = null;

export default function BookingsPage() {
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchAppointments = useCallback(async () => {
    if (!appointmentsCache || appointmentsCache.length === 0) {
      setLoading(true);
    }
    setError('');
    try {
      const data = await bookingsService.getAppointments({});
      const normalized = (Array.isArray(data) ? data : []).map((apt) => ({
        ...apt,
        normalizedStatus: deriveStatus(apt),
      }));
      setAppointments(normalized);
      appointmentsCache = normalized;
    } catch (err) {
      setError('Failed to load appointments. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (Array.isArray(appointmentsCache)) {
      setAppointments(
        appointmentsCache.map((apt) => ({
          ...apt,
          normalizedStatus: apt.normalizedStatus || deriveStatus(apt),
        }))
      );
      setLoading(false);
    }
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

  const handleDelete = async (apt) => {
    if (!apt?.id) return;
    setDeleteTarget(apt);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget?.id) return;
    const targetId = deleteTarget.id;
    const previousAppointments = appointments;

    try {
      setIsDeleting(true);
      setError('');
      setDeleteTarget(null);
      setExpandedId((prev) => (prev === targetId ? null : prev));
      setAppointments((prev) => prev.filter((apt) => apt.id !== targetId));

      await bookingsService.deleteAppointment(targetId);
    } catch {
      setAppointments(previousAppointments);
      setError('Failed to delete appointment. Restored previous list.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleJoinMeeting = (appointment) => {
    if (!appointment) return;

    let resolvedMeetingId = appointment.meetingId;

    if (!resolvedMeetingId && appointment.meetingLink) {
      try {
        const link = new URL(appointment.meetingLink, window.location.origin);
        resolvedMeetingId = link.searchParams.get('meetingId') || link.searchParams.get('id');
      } catch (e) {
        console.error('Failed to parse meetingLink:', e);
      }
    }

    if (!resolvedMeetingId) {
      setError('Unable to join: meeting ID is missing for this appointment.');
      return;
    }

    const params = new URLSearchParams({
      meetingId: resolvedMeetingId,
      role: 'admin',
    });

    if (appointment.leadId) params.set('leadId', appointment.leadId);
    if (appointment.id) params.set('appointmentId', appointment.id);

    navigate(`/meeting?${params.toString()}`);
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
  }).filter(apt => (statusFilter === 'all' ? true : apt.normalizedStatus === statusFilter));

  const statusCounts = STATUS_FILTERS.reduce((acc, filter) => {
    if (filter.key === 'all') {
      acc[filter.key] = appointments.length;
      return acc;
    }
    acc[filter.key] = appointments.filter((apt) => apt.normalizedStatus === filter.key).length;
    return acc;
  }, {});

  const upcoming = filtered
    .filter(a => a.normalizedStatus === 'confirmed' || a.normalizedStatus === 'pending')
    .sort((a, b) => a.date.localeCompare(b.date));
  const past = filtered.filter(a => (
    a.normalizedStatus === 'completed'
    || a.normalizedStatus === 'cancelled'
    || a.normalizedStatus === 'no_show'
    || a.normalizedStatus === 'past_due'
    || a.normalizedStatus === 'incomplete'
  ));

  const renderLoading = (
    <div className="h-full flex items-center justify-center py-20">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-400 mx-auto mb-4" />
        <p className="text-gray-500 dark:text-gray-400">Loading appointments...</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header + Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Appointments</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">{appointments.length} total appointments</p>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
          <div className="relative sm:w-80 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, email, or date..."
              className="w-full pl-10 pr-4 py-2.5 bg-gray-100 dark:bg-slate-900/40 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
            />
          </div>
          <button
            onClick={fetchAppointments}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        {STATUS_FILTERS.map((filter) => {
          const isActive = statusFilter === filter.key;
          const count = statusCounts[filter.key] || 0;
          return (
            <button
              key={filter.key}
              onClick={() => setStatusFilter(filter.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                isActive ? 'bg-blue-600 text-white border-blue-500' : 'border-gray-300 dark:border-white/20 text-gray-600 dark:text-gray-200 hover:border-gray-400 dark:hover:border-white/40'
              }`}
            >
              {filter.label} {filter.key !== 'all' && <span className="opacity-70">({count})</span>}
            </button>
          );
        })}
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 rounded-xl px-4 py-3 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {loading ? (
        renderLoading
      ) : (
        <>
          {/* Upcoming Section */}
          {upcoming.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
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
                    onDelete={handleDelete}
                    onJoin={handleJoinMeeting}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Past Section */}
          {past.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
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
                    onDelete={handleDelete}
                    onJoin={handleJoinMeeting}
                  />
                ))}
              </div>
            </div>
          )}

          {filtered.length === 0 && (
            <div className="text-center py-20">
              <Calendar className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400 text-lg">No appointments found</p>
              <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">Appointments will appear here when leads book consultations.</p>
            </div>
          )}
        </>
      )}

      <DeleteConfirmModal
        open={!!deleteTarget}
        title="Delete Appointment"
        message={
          deleteTarget
            ? `Delete appointment for ${deleteTarget.customerName || 'this client'}${deleteTarget.bookingRef ? ` (${deleteTarget.bookingRef})` : ''}?\n\nThe appointment will be removed permanently.`
            : ''
        }
        confirmLabel="Delete Appointment"
        loading={isDeleting}
        onCancel={() => {
          if (!isDeleting) setDeleteTarget(null);
        }}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}

function AppointmentCard({ apt, expanded, onToggle, onStatusChange, onCancel, onDelete, onJoin }) {
  const statusKey = apt.normalizedStatus || apt.status;
  const status = STATUS_COLORS[statusKey] || STATUS_COLORS.pending;
  const isUpcoming = statusKey === 'confirmed' || statusKey === 'pending';

  return (
    <div className={`bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl overflow-hidden transition-all hover:border-gray-300 dark:hover:border-white/20`}>
      {/* Header Row */}
      <div
        className="flex items-center justify-between px-5 py-4 cursor-pointer"
        onClick={onToggle}
      >
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-10 h-10 bg-blue-100 dark:bg-blue-600/20 rounded-xl flex items-center justify-center flex-shrink-0">
            <User className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-gray-900 dark:text-white font-medium truncate">{apt.customerName || 'Unknown'}</p>
              {apt.bookingRef && (
                <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-600/20 text-blue-700 dark:text-blue-300 text-xs font-bold rounded">
                  {apt.bookingRef}
                </span>
              )}
            </div>
            <p className="text-gray-500 dark:text-gray-400 text-sm truncate">{apt.serviceName}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-gray-900 dark:text-white text-sm font-medium">
              {bookingsService.formatDate(apt.date)}
            </p>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              {bookingsService.formatTime(apt.startTime)} – {bookingsService.formatTime(apt.endTime)}
            </p>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${status.bg} ${status.text} border ${status.border}`}>
            {status.label}
          </span>
          <ChevronDown className={`w-4 h-4 text-gray-400 dark:text-gray-500 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="border-t border-gray-100 dark:border-white/5 px-5 py-4">
          <div className="grid md:grid-cols-3 gap-4 mb-4">
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="w-4 h-4 text-gray-400 dark:text-gray-500" />
              <span className="text-gray-500 dark:text-gray-400">Date:</span>
              <span className="text-gray-900 dark:text-white">{bookingsService.formatDate(apt.date)}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Clock className="w-4 h-4 text-gray-400 dark:text-gray-500" />
              <span className="text-gray-500 dark:text-gray-400">Time:</span>
              <span className="text-gray-900 dark:text-white">
                {bookingsService.formatTime(apt.startTime)} – {bookingsService.formatTime(apt.endTime)}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="w-4 h-4 text-gray-400 dark:text-gray-500" />
              <span className="text-gray-500 dark:text-gray-400">Timezone:</span>
              <span className="text-gray-900 dark:text-white">{apt.timezone}</span>
            </div>
            {apt.customerEmail && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                <span className="text-gray-500 dark:text-gray-400">Email:</span>
                <span className="text-gray-900 dark:text-white">{apt.customerEmail}</span>
              </div>
            )}
            {apt.customerPhone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                <span className="text-gray-500 dark:text-gray-400">Phone:</span>
                <span className="text-gray-900 dark:text-white">{apt.customerPhone}</span>
              </div>
            )}
          </div>

          {apt.notes && (
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-4 bg-gray-50 dark:bg-white/5 rounded-lg p-3">
              <span className="font-medium text-gray-700 dark:text-gray-300">Notes:</span> {apt.notes}
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            {isUpcoming && (apt.meetingId || apt.meetingLink) && (
              <button
                onClick={(e) => { e.stopPropagation(); onJoin(apt); }}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-all"
              >
                <Video className="w-4 h-4" />
                Join Meeting
              </button>
            )}
            {apt.status === 'confirmed' && (
              <button
                onClick={(e) => { e.stopPropagation(); onStatusChange(apt.id, 'completed'); }}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-50 dark:bg-emerald-600/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 rounded-lg text-sm font-medium hover:bg-emerald-100 dark:hover:bg-emerald-600/30 transition-all"
              >
                <CheckCircle className="w-4 h-4" />
                Mark Complete
              </button>
            )}
            {apt.status === 'confirmed' && (
              <button
                onClick={(e) => { e.stopPropagation(); onStatusChange(apt.id, 'no_show'); }}
                className="flex items-center gap-2 px-4 py-2 bg-gray-50 dark:bg-gray-600/20 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-500/20 rounded-lg text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-600/30 transition-all"
              >
                No Show
              </button>
            )}
            {isUpcoming && (
              <button
                onClick={(e) => { e.stopPropagation(); onCancel(apt.id); }}
                className="flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-600/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/20 rounded-lg text-sm font-medium hover:bg-red-100 dark:hover:bg-red-600/30 transition-all"
              >
                <XCircle className="w-4 h-4" />
                Cancel
              </button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(apt); }}
              className="flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-700/20 text-red-600 dark:text-red-300 border border-red-200 dark:border-red-700/30 rounded-lg text-sm font-medium hover:bg-red-100 dark:hover:bg-red-700/30 transition-all"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
