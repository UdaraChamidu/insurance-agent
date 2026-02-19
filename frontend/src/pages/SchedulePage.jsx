import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Clock, ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, Loader, CheckCircle, Globe, MapPin, AlertCircle } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

import { sendBookingConfirmation } from '../services/frontendEmailService';

const TIMEZONE_OPTIONS = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HT)' },
];

export default function SchedulePage() {
  const navigate = useNavigate();

  // Lead context
  const [leadId, setLeadId] = useState(null);
  const [leadName, setLeadName] = useState('');
  const [leadEmail, setLeadEmail] = useState('');
  const [productType, setProductType] = useState('');

  // Calendar state
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [timezone, setTimezone] = useState('America/New_York');

  // Data
  const [lead, setLead] = useState(null);
  const [availability, setAvailability] = useState([]);
  const [loading, setLoading] = useState(true);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [booking, setBooking] = useState(false);
  const [bookingResult, setBookingResult] = useState(null);
  const [error, setError] = useState('');

  // Fetch lead context
  useEffect(() => {
    const id = localStorage.getItem('currentLeadId');
    if (id) {
      setLeadId(id);
      fetch(`${API_URL}/api/leads/${id}`)
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data) {
            setLead(data);
            setLeadName(data.contactInfo?.firstName || data.firstName || '');
            setLeadEmail(data.contactInfo?.email || data.email || '');
            setProductType(data.productType || '');
          }
        })
        .catch(() => {});
    }
    setLoading(false);
  }, []);

  // Fetch availability when month changes
  useEffect(() => {
    fetchAvailability();
  }, [currentMonth]);

  const fetchAvailability = async () => {
    setSlotsLoading(true);
    try {
      const from = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
      const to = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);

      const fromStr = from.toISOString().split('T')[0];
      const toStr = to.toISOString().split('T')[0];

      const res = await fetch(`${API_URL}/api/scheduling/availability?from=${fromStr}&to=${toStr}`);
      if (res.ok) {
        const data = await res.json();
        setAvailability(data);
      }
    } catch (err) {
      console.error('Error fetching availability:', err);
    } finally {
      setSlotsLoading(false);
    }
  };

  // Get available dates set
  const availableDates = useMemo(() => {
    const dates = new Set();
    availability.forEach(day => dates.add(day.date));
    return dates;
  }, [availability]);

  // Get slots for selected date
  const slotsForDate = useMemo(() => {
    if (!selectedDate) return [];
    const dateStr = selectedDate.toISOString().split('T')[0];
    const dayData = availability.find(d => d.date === dateStr);
    return dayData ? dayData.slots : [];
  }, [selectedDate, availability]);

  // Calendar generation
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPad = firstDay.getDay(); // 0=Sun
    const days = [];

    // Padding
    for (let i = 0; i < startPad; i++) {
      days.push(null);
    }

    // Days
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const date = new Date(year, month, d);
      const dateStr = date.toISOString().split('T')[0];
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      days.push({
        date,
        dateStr,
        day: d,
        isToday: date.toDateString() === today.toDateString(),
        isPast: date < today,
        hasSlots: availableDates.has(dateStr),
      });
    }

    return days;
  }, [currentMonth, availableDates]);

  const handleDateClick = (dayInfo) => {
    if (!dayInfo || dayInfo.isPast || !dayInfo.hasSlots) return;
    setSelectedDate(dayInfo.date);
    setSelectedSlot(null);
  };

  const handleSlotClick = (slot) => {
    setSelectedSlot(slot);
  };

  const handleBooking = async () => {
    if (!selectedDate || !selectedSlot || !leadId) {
      setError('Missing booking information. Please complete the intake form first.');
      return;
    }

    setBooking(true);
    setError('');

    try {
      const dateStr = selectedDate.toISOString().split('T')[0];

      const res = await fetch(`${API_URL}/api/scheduling/appointments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId,
          date: dateStr,
          startTime: selectedSlot.startTime,
          timezone,
          durationMinutes: 30,
          serviceName: productType
            ? `${productType.toUpperCase()} Consultation`
            : 'Insurance Consultation',
        }),
      });

      const data = await res.json();

      if (data.success) {
        setBookingResult(data);
        // Send confirmation email via frontend service
        if (lead) {
          sendBookingConfirmation(data.appointment, lead).catch(err => console.error('Email failed:', err));
        }
      } else {
        setError(data.detail || 'Failed to book appointment. Please try again.');
      }
    } catch (err) {
      console.error('Booking error:', err);
      setError('Network error. Please try again.');
    } finally {
      setBooking(false);
    }
  };

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
    setSelectedDate(null);
    setSelectedSlot(null);
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
    setSelectedDate(null);
    setSelectedSlot(null);
  };

  const monthLabel = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const formatTime12 = (time24) => {
    const [h, m] = time24.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
  };

  // ===== SUCCESS SCREEN =====
  if (bookingResult) {
    const apt = bookingResult.appointment;
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
        <div className="max-w-lg w-full bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl p-8 text-center">
          <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-emerald-400" />
          </div>

          <h2 className="text-3xl font-bold text-white mb-2">You're All Set!</h2>
          <p className="text-gray-300 mb-4">Your consultation has been confirmed.</p>

          {apt.bookingRef && (
            <div className="inline-block bg-blue-600/20 border border-blue-500/30 rounded-lg px-4 py-2 mb-6">
              <span className="text-sm text-gray-400 mr-2">Booking Reference:</span>
              <span className="text-blue-300 font-bold text-xl">{apt.bookingRef}</span>
            </div>
          )}

          <div className="bg-white/5 border border-white/10 rounded-xl p-6 mb-6 text-left space-y-3">
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-blue-400 flex-shrink-0" />
              <div>
                <p className="text-sm text-gray-400">Date</p>
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
                <p className="text-sm text-gray-400">Time</p>
                <p className="text-white font-semibold">
                  {formatTime12(apt.startTime)} – {formatTime12(apt.endTime)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Globe className="w-5 h-5 text-blue-400 flex-shrink-0" />
              <div>
                <p className="text-sm text-gray-400">Timezone</p>
                <p className="text-white font-semibold">
                  {TIMEZONE_OPTIONS.find(t => t.value === apt.timezone)?.label || apt.timezone}
                </p>
              </div>
            </div>
          </div>

          <p className="text-sm text-gray-400 mb-4">
            A confirmation email will be sent to <span className="text-blue-300">{leadEmail}</span>.
            You'll receive a reminder before your appointment.
          </p>

          {apt.manageToken && (
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-6 text-center">
              <p className="text-xs text-gray-400 mb-2">Need to cancel or reschedule?</p>
              <button
                onClick={() => navigate(`/appointment/manage/${apt.manageToken}`)}
                className="text-blue-400 hover:text-blue-300 text-sm font-medium underline underline-offset-2"
              >
                Manage your appointment →
              </button>
            </div>
          )}

          <button
            onClick={() => navigate('/')}
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold transition-all shadow-lg shadow-blue-600/20"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  // ===== MAIN SCHEDULING UI =====
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      {/* Navigation Header */}
      <header className="bg-black/30 backdrop-blur-md border-b border-white/10 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-3">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate('/')}
              className="flex items-center space-x-2 text-white hover:text-blue-400 transition-colors"
            >
              <Calendar className="h-5 w-5 text-blue-400" />
              <span className="text-lg font-bold">Elite Deal Broker</span>
            </button>
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/')}
                className="text-gray-300 hover:text-white transition-colors text-sm font-medium"
              >
                Home
              </button>
              <button
                onClick={() => navigate('/intake')}
                className="text-gray-300 hover:text-white transition-colors text-sm font-medium"
              >
                Book Consultation
              </button>
              <button
                onClick={() => navigate('/admin')}
                className="bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 font-medium py-1.5 px-3 rounded-lg text-sm transition-all border border-blue-500/30"
              >
                Admin Panel
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-8">

        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
          {/* Title Bar */}
          <div className="p-8 text-center border-b border-white/5">
            <h1 className="text-3xl font-bold text-white mb-2">
              {leadName ? `Welcome, ${leadName}!` : 'Schedule Your Consultation'}
            </h1>
            <p className="text-gray-400">
              Select a date and time below to speak with a licensed agent.
            </p>
          </div>

          <div className="grid md:grid-cols-5 min-h-[520px]">
            {/* LEFT: Calendar */}
            <div className="md:col-span-3 p-6 border-r border-white/5">
              {/* Timezone Selector */}
              <div className="flex items-center gap-2 mb-6">
                <Globe className="w-4 h-4 text-gray-400" />
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="bg-white/5 border border-white/10 text-white text-sm rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  {TIMEZONE_OPTIONS.map(tz => (
                    <option key={tz.value} value={tz.value} className="bg-slate-800">
                      {tz.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Month Navigation */}
              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={prevMonth}
                  className="p-2 rounded-lg hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <h3 className="text-lg font-semibold text-white">{monthLabel}</h3>
                <button
                  onClick={nextMonth}
                  className="p-2 rounded-lg hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              {/* Day Headers */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} className="text-center text-xs font-medium text-gray-500 py-2">
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((dayInfo, idx) => {
                  if (!dayInfo) {
                    return <div key={`pad-${idx}`} className="h-12" />;
                  }

                  const isSelected = selectedDate?.toDateString() === dayInfo.date.toDateString();
                  const canSelect = !dayInfo.isPast && dayInfo.hasSlots;

                  return (
                    <button
                      key={dayInfo.dateStr}
                      onClick={() => handleDateClick(dayInfo)}
                      disabled={!canSelect}
                      className={`h-12 rounded-xl text-sm font-medium transition-all relative flex items-center justify-center
                        ${isSelected
                          ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 scale-105'
                          : canSelect
                            ? 'text-white hover:bg-white/10 hover:scale-105'
                            : 'text-gray-600 cursor-not-allowed'
                        }
                        ${dayInfo.isToday && !isSelected ? 'ring-1 ring-blue-500/50' : ''}
                      `}
                    >
                      {dayInfo.day}
                      {dayInfo.hasSlots && !isSelected && (
                        <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-emerald-400" />
                      )}
                    </button>
                  );
                })}
              </div>

              {slotsLoading && (
                <div className="flex justify-center mt-4">
                  <Loader className="w-5 h-5 text-blue-400 animate-spin" />
                </div>
              )}
            </div>

            {/* RIGHT: Time Slots */}
            <div className="md:col-span-2 p-6 bg-white/[0.02]">
              {selectedDate ? (
                <>
                  <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-1">
                    Available Times
                  </h3>
                  <p className="text-white font-medium mb-4">
                    {selectedDate.toLocaleDateString('en-US', {
                      weekday: 'long', month: 'long', day: 'numeric'
                    })}
                  </p>

                  {slotsForDate.length === 0 ? (
                    <p className="text-gray-500 text-sm">No slots available for this date.</p>
                  ) : (
                    <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1 custom-scrollbar">
                      {slotsForDate.map((slot, idx) => {
                        const isChosen = selectedSlot?.startTime === slot.startTime;
                        return (
                          <button
                            key={idx}
                            onClick={() => handleSlotClick(slot)}
                            className={`w-full py-3 px-4 rounded-xl border text-sm font-medium transition-all flex items-center gap-3
                              ${isChosen
                                ? 'border-blue-500 bg-blue-600/20 text-blue-300 shadow-md shadow-blue-500/10'
                                : 'border-white/10 text-gray-300 hover:border-blue-500/50 hover:bg-white/5'
                              }
                            `}
                          >
                            <Clock className="w-4 h-4 flex-shrink-0" />
                            <span>{formatTime12(slot.startTime)} – {formatTime12(slot.endTime)}</span>
                            {isChosen && <CheckCircle className="w-4 h-4 ml-auto text-blue-400" />}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Confirm Button */}
                  {selectedSlot && (
                    <div className="mt-6">
                      {error && (
                        <div className="flex items-center gap-2 text-red-400 text-sm mb-3">
                          <AlertCircle className="w-4 h-4" />
                          <span>{error}</span>
                        </div>
                      )}
                      <button
                        onClick={handleBooking}
                        disabled={booking}
                        className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl font-bold shadow-lg shadow-blue-600/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {booking ? (
                          <Loader className="w-5 h-5 animate-spin" />
                        ) : (
                          <>
                            <CheckCircle className="w-5 h-5" />
                            Confirm Booking
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mb-4">
                    <Calendar className="w-8 h-8 text-gray-500" />
                  </div>
                  <p className="text-gray-400 text-sm max-w-[200px]">
                    Select a date on the calendar to see available time slots
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
