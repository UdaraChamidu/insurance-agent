
import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Calendar, Clock, AlertTriangle, CheckCircle, XCircle,
  Loader, ChevronLeft, ChevronRight, Shield, Globe, RefreshCw, AlertCircle, ArrowLeft
} from 'lucide-react';
import { sendCancellationEmail, sendRescheduleEmail } from '../services/frontendEmailService';
import { getApiBaseUrl } from '../utils/network';

const API_URL = getApiBaseUrl();

const TIMEZONE_OPTIONS = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HT)' },
];

const formatTime12 = (time24) => {
  if (!time24) return '';
  const [h, m] = time24.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
};

export default function ManageAppointmentPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [appointment, setAppointment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionResult, setActionResult] = useState(null); // { type: 'cancelled' | 'rescheduled', data }
  const [showReschedule, setShowReschedule] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [successMsg, setSuccessMsg] = useState(''); // Added success message state

  // Reschedule state
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [timezone, setTimezone] = useState('America/New_York');
  const [availability, setAvailability] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);

  // Fetch appointment on load
  useEffect(() => {
    fetchAppointment();
  }, [token]);

  // Handle query params for auto-open
  useEffect(() => {
    if (!appointment) return;
    const action = searchParams.get('action');
    if (action === 'reschedule' && !showReschedule && appointment.status !== 'cancelled') {
      setShowReschedule(true);
    }
    if (action === 'cancel' && !showCancelConfirm && appointment.status !== 'cancelled') {
      setShowCancelConfirm(true);
    }
  }, [searchParams, appointment]);

  const fetchAppointment = async () => {
    try {
      const res = await fetch(`${API_URL}/api/scheduling/manage/${token}`);
      if (!res.ok) {
        if (res.status === 404) {
          setError('This appointment link is invalid or has expired.');
        } else {
          setError('Failed to load appointment details.');
        }
        return;
      }
      const data = await res.json();
      setAppointment(data);
      setTimezone(data.timezone || 'America/New_York');
    } catch (err) {
      setError('Network error. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch availability for reschedule calendar
  useEffect(() => {
    if (showReschedule) fetchAvailability();
  }, [currentMonth, showReschedule]);

  const fetchAvailability = async () => {
    setSlotsLoading(true);
    try {
      const from = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
      const to = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
      const fromStr = from.toISOString().split('T')[0];
      const toStr = to.toISOString().split('T')[0];

      const res = await fetch(`${API_URL}/api/scheduling/availability?from=${fromStr}&to=${toStr}`);
      if (res.ok) setAvailability(await res.json());
    } catch (err) {
      console.error('Error fetching availability:', err);
    } finally {
      setSlotsLoading(false);
    }
  };

  const availableDates = useMemo(() => {
    const dates = new Set();
    availability.forEach(day => dates.add(day.date));
    return dates;
  }, [availability]);

  const slotsForDate = useMemo(() => {
    if (!selectedDate) return [];
    const dateStr = selectedDate.toISOString().split('T')[0];
    const dayData = availability.find(d => d.date === dateStr);
    return dayData ? dayData.slots : [];
  }, [selectedDate, availability]);

  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPad = firstDay.getDay();
    const days = [];
    for (let i = 0; i < startPad; i++) days.push(null);
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const date = new Date(year, month, d);
      const dateStr = date.toISOString().split('T')[0];
      const today = new Date(); today.setHours(0, 0, 0, 0);
      days.push({
        date, dateStr, day: d,
        isToday: date.toDateString() === today.toDateString(),
        isPast: date < today,
        hasSlots: availableDates.has(dateStr),
      });
    }
    return days;
  }, [currentMonth, availableDates]);

  // Cancel handler
  const handleCancel = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/scheduling/manage/${token}/cancel`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setAppointment(data.appointment);
        setActionResult({ type: 'cancelled', data: data.appointment }); // Keep actionResult for display
        setSuccessMsg('Appointment cancelled successfully.');
        setShowCancelConfirm(false);
        // Send cancellation email
        sendCancellationEmail(data.appointment).catch(err => console.error('Email failed:', err));
      } else {
        setError(data.detail || 'Failed to cancel appointment.');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setActionLoading(false);
      setShowCancelConfirm(false);
    }
  };

  // Reschedule handler
  const handleReschedule = async () => {
    if (!selectedDate || !selectedSlot) return;
    setActionLoading(true);
    try {
      const dateStr = selectedDate.toISOString().split('T')[0];
      const res = await fetch(`${API_URL}/api/scheduling/manage/${token}/reschedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: dateStr, startTime: selectedSlot.startTime, timezone }),
      });
      const data = await res.json();
      if (data.success) {
        setAppointment(data.appointment);
        setSuccessMsg('Appointment rescheduled successfully!');
        setShowReschedule(false);
        setActionResult({ type: 'rescheduled', data: data.appointment });
        // Send reschedule email
        sendRescheduleEmail(data.appointment).catch(err => console.error('Email failed:', err));
      } else {
        setError(data.detail || 'Failed to reschedule appointment.');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const monthLabel = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  // ===== LOADING =====
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <Loader className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    );
  }

  // ===== ERROR =====
  if (error && !appointment) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-8 text-center">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Link Not Found</h2>
          <p className="text-gray-400 mb-6">{error}</p>
          <button onClick={() => navigate('/')} className="text-blue-400 hover:text-blue-300 text-sm">
            ← Back to Home
          </button>
        </div>
      </div>
    );
  }

  // ===== ACTION RESULT (Cancelled or Rescheduled) =====
  if (actionResult) {
    const apt = actionResult.data;
    const isCancelled = actionResult.type === 'cancelled';
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
        <div className="max-w-lg w-full bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl p-8 text-center">
          <div className={`w-20 h-20 ${isCancelled ? 'bg-orange-500/20' : 'bg-emerald-500/20'} rounded-full flex items-center justify-center mx-auto mb-6`}>
            {isCancelled
              ? <XCircle className="w-10 h-10 text-orange-400" />
              : <CheckCircle className="w-10 h-10 text-emerald-400" />
            }
          </div>
          <h2 className="text-3xl font-bold text-white mb-2">
            {isCancelled ? 'Appointment Cancelled' : 'Appointment Rescheduled'}
          </h2>
          <p className="text-gray-300 mb-6">
            {isCancelled
              ? 'Your appointment has been successfully cancelled.'
              : 'Your appointment has been rescheduled to the new time below.'
            }
          </p>

          {apt.bookingRef && (
            <div className="inline-block bg-blue-600/20 border border-blue-500/30 rounded-lg px-4 py-2 mb-6">
              <span className="text-sm text-gray-400 mr-2">Booking Ref:</span>
              <span className="text-blue-300 font-bold text-lg">{apt.bookingRef}</span>
            </div>
          )}

          {!isCancelled && (
            <div className="bg-white/5 border border-white/10 rounded-xl p-5 mb-6 text-left space-y-3">
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-blue-400 flex-shrink-0" />
                <div>
                  <p className="text-sm text-gray-400">New Date</p>
                  <p className="text-white font-semibold">
                    {new Date(apt.date + 'T00:00:00').toLocaleDateString('en-US', {
                      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
                    })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-blue-400 flex-shrink-0" />
                <div>
                  <p className="text-sm text-gray-400">New Time</p>
                  <p className="text-white font-semibold">
                    {formatTime12(apt.startTime)} – {formatTime12(apt.endTime)}
                  </p>
                </div>
              </div>
            </div>
          )}

          <button onClick={() => navigate('/')} className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold transition-all">
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  // ===== MAIN VIEW =====
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      {/* Header */}
      <header className="bg-black/30 backdrop-blur-md border-b border-white/10 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-white">
              <Shield className="h-5 w-5 text-blue-400" />
              <span className="text-lg font-bold">Elite Deal Broker</span>
            </div>
            <button onClick={() => navigate('/')} className="text-gray-300 hover:text-white text-sm">
              Home
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-10">
        {/* Appointment Card */}
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl overflow-hidden">
          {/* Title */}
          <div className="p-6 border-b border-white/10 text-center">
            <h1 className="text-2xl font-bold text-white mb-1">Manage Your Appointment</h1>
            {appointment.bookingRef && (
              <div className="inline-block bg-blue-600/20 border border-blue-500/30 rounded-lg px-3 py-1 mt-2">
                <span className="text-xs text-gray-400 mr-1">Ref:</span>
                <span className="text-blue-300 font-bold">{appointment.bookingRef}</span>
              </div>
            )}
          </div>

          {/* Details */}
          <div className="p-6 space-y-4">
            {appointment.status === 'cancelled' && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-center gap-3">
                <XCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                <p className="text-red-300 text-sm font-medium">This appointment has been cancelled.</p>
              </div>
            )}

            <div className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-4">
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-blue-400 flex-shrink-0" />
                <div>
                  <p className="text-sm text-gray-400">Date</p>
                  <p className="text-white font-semibold">
                    {new Date(appointment.date + 'T00:00:00').toLocaleDateString('en-US', {
                      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
                    })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-blue-400 flex-shrink-0" />
                <div>
                  <p className="text-sm text-gray-400">Time</p>
                  <p className="text-white font-semibold">
                    {formatTime12(appointment.startTime)} – {formatTime12(appointment.endTime)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Globe className="w-5 h-5 text-blue-400 flex-shrink-0" />
                <div>
                  <p className="text-sm text-gray-400">Timezone</p>
                  <p className="text-white font-semibold">
                    {TIMEZONE_OPTIONS.find(t => t.value === appointment.timezone)?.label || appointment.timezone}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5 text-blue-400 flex-shrink-0" />
                <div>
                  <p className="text-sm text-gray-400">Service</p>
                  <p className="text-white font-semibold">{appointment.serviceName}</p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            {appointment.status !== 'cancelled' && !showReschedule && (
              <div className="flex gap-3">
                <button
                  onClick={() => setShowReschedule(true)}
                  className="flex-1 py-3 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 rounded-xl font-semibold transition-all flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-5 h-5" />
                  Reschedule
                </button>
                <button
                  onClick={() => setShowCancelConfirm(true)}
                  className="flex-1 py-3 bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/30 rounded-xl font-semibold transition-all flex items-center justify-center gap-2"
                >
                  <XCircle className="w-5 h-5" />
                  Cancel
                </button>
              </div>
            )}

            {/* Cancel Confirmation */}
            {showCancelConfirm && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-5 space-y-4">
                <p className="text-white text-sm font-medium text-center">
                  Are you sure you want to cancel this appointment?
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowCancelConfirm(false)}
                    disabled={actionLoading}
                    className="flex-1 py-2.5 bg-white/10 hover:bg-white/20 text-gray-300 rounded-xl text-sm font-medium transition-all"
                  >
                    Keep Appointment
                  </button>
                  <button
                    onClick={handleCancel}
                    disabled={actionLoading}
                    className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2"
                  >
                    {actionLoading ? <Loader className="w-4 h-4 animate-spin" /> : 'Yes, Cancel'}
                  </button>
                </div>
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>

          {/* Reschedule Calendar */}
          {showReschedule && appointment.status !== 'cancelled' && (
            <div className="border-t border-white/10 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Pick a New Time</h3>
                <button
                  onClick={() => { setShowReschedule(false); setSelectedDate(null); setSelectedSlot(null); }}
                  className="text-gray-400 hover:text-white text-sm"
                >
                  Cancel
                </button>
              </div>

              {/* Timezone */}
              <div className="flex items-center gap-2 mb-4">
                <Globe className="w-4 h-4 text-gray-400" />
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="bg-white/5 border border-white/10 text-white text-sm rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  {TIMEZONE_OPTIONS.map(tz => (
                    <option key={tz.value} value={tz.value} className="bg-slate-800">{tz.label}</option>
                  ))}
                </select>
              </div>

              {/* Month Nav */}
              <div className="flex items-center justify-between mb-3">
                <button onClick={() => { setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1)); setSelectedDate(null); setSelectedSlot(null); }}
                  className="p-2 rounded-lg hover:bg-white/10 text-gray-300 hover:text-white transition-colors">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <h3 className="text-md font-semibold text-white">{monthLabel}</h3>
                <button onClick={() => { setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1)); setSelectedDate(null); setSelectedSlot(null); }}
                  className="p-2 rounded-lg hover:bg-white/10 text-gray-300 hover:text-white transition-colors">
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              {/* Calendar */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} className="text-center text-xs font-medium text-gray-500 py-1.5">{day}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1 mb-4">
                {calendarDays.map((dayInfo, idx) => {
                  if (!dayInfo) return <div key={`pad-${idx}`} className="h-10" />;
                  const isSelected = selectedDate?.toDateString() === dayInfo.date.toDateString();
                  const canSelect = !dayInfo.isPast && dayInfo.hasSlots;
                  return (
                    <button key={dayInfo.dateStr}
                      onClick={() => { if (canSelect) { setSelectedDate(dayInfo.date); setSelectedSlot(null); } }}
                      disabled={!canSelect}
                      className={`h-10 rounded-lg text-sm font-medium transition-all relative flex items-center justify-center
                        ${isSelected ? 'bg-blue-600 text-white shadow-lg scale-105'
                          : canSelect ? 'text-white hover:bg-white/10' : 'text-gray-600 cursor-not-allowed'}
                        ${dayInfo.isToday && !isSelected ? 'ring-1 ring-blue-500/50' : ''}
                      `}>
                      {dayInfo.day}
                      {dayInfo.hasSlots && !isSelected && (
                        <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-emerald-400" />
                      )}
                    </button>
                  );
                })}
              </div>

              {slotsLoading && <div className="flex justify-center"><Loader className="w-5 h-5 text-blue-400 animate-spin" /></div>}

              {/* Time Slots */}
              {selectedDate && slotsForDate.length > 0 && (
                <div className="space-y-2 max-h-[240px] overflow-y-auto mb-4">
                  {slotsForDate.map((slot, idx) => {
                    const isChosen = selectedSlot?.startTime === slot.startTime;
                    return (
                      <button key={idx} onClick={() => setSelectedSlot(slot)}
                        className={`w-full py-2.5 px-4 rounded-xl border text-sm font-medium transition-all flex items-center gap-3
                          ${isChosen ? 'border-blue-500 bg-blue-600/20 text-blue-300' : 'border-white/10 text-gray-300 hover:border-blue-500/50 hover:bg-white/5'}
                        `}>
                        <Clock className="w-4 h-4" />
                        <span>{formatTime12(slot.startTime)} – {formatTime12(slot.endTime)}</span>
                        {isChosen && <CheckCircle className="w-4 h-4 ml-auto text-blue-400" />}
                      </button>
                    );
                  })}
                </div>
              )}

              {selectedDate && slotsForDate.length === 0 && !slotsLoading && (
                <p className="text-gray-500 text-sm text-center mb-4">No available slots for this date.</p>
              )}

              {/* Confirm Reschedule */}
              {selectedSlot && (
                <button onClick={handleReschedule} disabled={actionLoading}
                  className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl font-bold shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                  {actionLoading ? <Loader className="w-5 h-5 animate-spin" /> : (
                    <><RefreshCw className="w-5 h-5" /> Confirm Reschedule</>
                  )}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
