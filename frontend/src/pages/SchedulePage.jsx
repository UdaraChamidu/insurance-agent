import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  Calendar,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  Globe,
  Loader,
} from 'lucide-react';
import { getApiBaseUrl } from '../utils/network';
import { sendBookingConfirmation } from '../services/frontendEmailService';

const API_URL = getApiBaseUrl();

const TIMEZONE_OPTIONS = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HT)' },
];

const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());

const toDateKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const pageBackground = {
  background:
    'radial-gradient(circle at top, rgba(188,25,24,0.12), transparent 42%), linear-gradient(180deg, #fff8f7 0%, #f7f3f2 100%)',
};

export default function SchedulePage() {
  const navigate = useNavigate();

  const [leadId, setLeadId] = useState(null);
  const [leadName, setLeadName] = useState('');
  const [leadEmail, setLeadEmail] = useState('');
  const [productType, setProductType] = useState('');

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [timezone, setTimezone] = useState('America/New_York');

  const [lead, setLead] = useState(null);
  const [availability, setAvailability] = useState([]);
  const [loading, setLoading] = useState(true);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [booking, setBooking] = useState(false);
  const [bookingResult, setBookingResult] = useState(null);
  const [error, setError] = useState('');

  const hasValidLeadEmail = isValidEmail(leadEmail);

  useEffect(() => {
    const id = localStorage.getItem('currentLeadId');
    if (id) {
      setLeadId(id);
      fetch(`${API_URL}/api/leads/${id}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
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

  useEffect(() => {
    fetchAvailability();
  }, [currentMonth]);

  const fetchAvailability = async () => {
    setSlotsLoading(true);
    try {
      const from = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
      const to = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);

      const fromStr = toDateKey(from);
      const toStr = toDateKey(to);

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

  const availableDates = useMemo(() => {
    const dates = new Set();
    availability.forEach((day) => dates.add(day.date));
    return dates;
  }, [availability]);

  const slotsForDate = useMemo(() => {
    if (!selectedDate) return [];
    const dateStr = toDateKey(selectedDate);
    const dayData = availability.find((d) => d.date === dateStr);
    return dayData ? dayData.slots : [];
  }, [selectedDate, availability]);

  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPad = firstDay.getDay();
    const days = [];

    for (let i = 0; i < startPad; i += 1) {
      days.push(null);
    }

    for (let d = 1; d <= lastDay.getDate(); d += 1) {
      const date = new Date(year, month, d);
      const dateStr = toDateKey(date);
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
    setError('');
  };

  const handleSlotClick = (slot) => {
    setSelectedSlot(slot);
    setError('');
  };

  const handleBooking = async () => {
    if (!selectedDate || !selectedSlot || !leadId) {
      setError('Missing booking information. Please complete the intake form first.');
      return;
    }

    if (!hasValidLeadEmail) {
      setError('Please provide a valid email in intake before booking.');
      return;
    }

    setBooking(true);
    setError('');

    try {
      const dateStr = toDateKey(selectedDate);

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
        if (lead) {
          sendBookingConfirmation(data.appointment, lead).catch((err) => {
            console.error('Email failed:', err);
          });
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

  if (bookingResult) {
    const apt = bookingResult.appointment;

    return (
      <div className="flex min-h-screen items-center justify-center p-4" style={pageBackground}>
        <div className="w-full max-w-lg rounded-[2rem] border border-[var(--line)] bg-white p-8 text-center shadow-[0_32px_80px_rgba(59,33,29,0.16)]">
          <div
            className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full"
            style={{ background: 'rgba(188,25,24,0.12)' }}
          >
            <CheckCircle className="h-10 w-10 text-[var(--brand)]" />
          </div>

          <h2 className="mb-2 text-3xl font-bold text-slate-950">You're All Set!</h2>
          <p className="mb-4 text-slate-600">Your consultation has been confirmed.</p>

          {apt.bookingRef ? (
            <div className="mb-6 inline-block rounded-xl border border-[var(--brand-soft-strong)] bg-[var(--panel-soft)] px-4 py-2">
              <span className="mr-2 text-sm text-slate-500">Booking Reference:</span>
              <span className="text-xl font-bold text-[var(--brand-dark)]">{apt.bookingRef}</span>
            </div>
          ) : null}

          <div className="mb-6 space-y-3 rounded-[1.5rem] border border-[var(--line)] bg-[var(--panel-soft)] p-6 text-left">
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 flex-shrink-0 text-[var(--brand)]" />
              <div>
                <p className="text-sm text-slate-500">Date</p>
                <p className="font-semibold text-slate-950">
                  {new Date(`${apt.date}T00:00:00`).toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 flex-shrink-0 text-[var(--brand)]" />
              <div>
                <p className="text-sm text-slate-500">Time</p>
                <p className="font-semibold text-slate-950">
                  {formatTime12(apt.startTime)} - {formatTime12(apt.endTime)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Globe className="h-5 w-5 flex-shrink-0 text-[var(--brand)]" />
              <div>
                <p className="text-sm text-slate-500">Timezone</p>
                <p className="font-semibold text-slate-950">
                  {TIMEZONE_OPTIONS.find((t) => t.value === apt.timezone)?.label || apt.timezone}
                </p>
              </div>
            </div>
          </div>

          <p className="mb-4 text-sm text-slate-500">
            A confirmation email will be sent to{' '}
            <span className="font-semibold text-[var(--brand-dark)]">{leadEmail}</span>.
            You'll receive a reminder before your appointment.
          </p>

          {apt.manageToken ? (
            <div className="mb-6 rounded-[1.25rem] border border-[var(--line)] bg-[var(--panel-soft)] p-4 text-center">
              <p className="mb-2 text-xs text-slate-500">Need to cancel or reschedule?</p>
              <button
                className="text-sm font-medium text-[var(--brand-dark)] underline underline-offset-2 transition hover:text-[var(--brand-strong)]"
                onClick={() => navigate(`/appointment/manage/${apt.manageToken}`)}
                type="button"
              >
                Manage your appointment -&gt;
              </button>
            </div>
          ) : null}

          <button
            className="w-full rounded-xl bg-[var(--brand)] py-3 font-semibold text-white shadow-[0_20px_40px_rgba(188,25,24,0.18)] transition-all hover:bg-[var(--brand-dark)]"
            onClick={() => navigate('/')}
            type="button"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={pageBackground}>
      <header className="sticky top-0 z-10 border-b border-[var(--line)] bg-white/90 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-6 py-3">
          <div className="flex items-center justify-between">
            <button
              className="flex items-center space-x-2 text-slate-900 transition-colors hover:text-[var(--brand-dark)]"
              onClick={() => navigate('/')}
              type="button"
            >
              <Calendar className="h-5 w-5 text-[var(--brand)]" />
              <span className="text-lg font-bold">Elite Deal Broker</span>
            </button>
            <div className="flex items-center gap-4">
              <button
                className="text-sm font-medium text-slate-600 transition-colors hover:text-[var(--brand-dark)]"
                onClick={() => navigate('/')}
                type="button"
              >
                Home
              </button>
              <button
                className="text-sm font-medium text-slate-600 transition-colors hover:text-[var(--brand-dark)]"
                onClick={() => navigate('/intake')}
                type="button"
              >
                Book Consultation
              </button>
              <button
                className="rounded-lg border border-[var(--brand-soft-strong)] bg-[var(--panel-soft)] px-3 py-1.5 text-sm font-medium text-[var(--brand-dark)] transition-all hover:bg-white"
                onClick={() => navigate('/admin')}
                type="button"
              >
                Admin Panel
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="overflow-hidden rounded-[2rem] border border-[var(--line)] bg-white shadow-[0_30px_80px_rgba(59,33,29,0.1)]">
          <div className="border-b border-[var(--line)] bg-[var(--panel-soft)] p-8 text-center">
            <h1 className="mb-2 text-3xl font-bold text-slate-950">
              {leadName ? `Welcome, ${leadName}!` : 'Schedule Your Consultation'}
            </h1>
            <p className="text-slate-600">
              Select a date and time below to speak with a licensed agent.
            </p>
          </div>

          <div className="min-h-[520px] grid md:grid-cols-5">
            <div className="border-b border-[var(--line)] p-6 md:col-span-3 md:border-b-0 md:border-r">
              <div className="mb-6 flex items-center gap-2">
                <Globe className="h-4 w-4 text-[var(--brand)]" />
                <select
                  className="rounded-lg border border-[var(--line)] bg-white px-3 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[var(--brand-soft-strong)]"
                  onChange={(e) => setTimezone(e.target.value)}
                  value={timezone}
                >
                  {TIMEZONE_OPTIONS.map((tz) => (
                    <option key={tz.value} value={tz.value}>
                      {tz.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mb-4 flex items-center justify-between">
                <button
                  className="rounded-lg border border-[var(--line)] bg-white p-2 text-slate-600 transition-colors hover:bg-[var(--panel-soft)] hover:text-[var(--brand-dark)]"
                  onClick={prevMonth}
                  type="button"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <h3 className="text-lg font-semibold text-slate-950">{monthLabel}</h3>
                <button
                  className="rounded-lg border border-[var(--line)] bg-white p-2 text-slate-600 transition-colors hover:bg-[var(--panel-soft)] hover:text-[var(--brand-dark)]"
                  onClick={nextMonth}
                  type="button"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>

              <div className="mb-2 grid grid-cols-7 gap-1">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                  <div key={day} className="py-2 text-center text-xs font-medium text-slate-500">
                    {day}
                  </div>
                ))}
              </div>

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
                      className={`relative flex h-12 items-center justify-center rounded-xl border border-transparent text-sm font-medium transition-all ${
                        isSelected
                          ? 'scale-105 bg-[var(--brand)] text-white shadow-[0_16px_30px_rgba(188,25,24,0.22)]'
                          : canSelect
                            ? 'text-slate-800 hover:bg-[var(--panel-soft)] hover:text-[var(--brand-dark)] hover:scale-105'
                            : 'cursor-not-allowed text-slate-400/80'
                      } ${dayInfo.isToday && !isSelected ? 'ring-1 ring-[var(--brand-soft-strong)]' : ''}`}
                      disabled={!canSelect}
                      onClick={() => handleDateClick(dayInfo)}
                      type="button"
                    >
                      {dayInfo.day}
                      {dayInfo.hasSlots && !isSelected ? (
                        <span className="absolute bottom-1.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-[var(--brand)]" />
                      ) : null}
                    </button>
                  );
                })}
              </div>

              {slotsLoading ? (
                <div className="mt-4 flex justify-center">
                  <Loader className="h-5 w-5 animate-spin text-[var(--brand)]" />
                </div>
              ) : null}
            </div>

            <div className="bg-[var(--panel-soft)] p-6 md:col-span-2">
              {selectedDate ? (
                <>
                  <h3 className="mb-1 text-sm font-semibold uppercase tracking-wider text-slate-500">
                    Available Times
                  </h3>
                  <p className="mb-4 font-medium text-slate-950">
                    {selectedDate.toLocaleDateString('en-US', {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>

                  {slotsForDate.length === 0 ? (
                    <p className="text-sm text-slate-500">No slots available for this date.</p>
                  ) : (
                    <div className="custom-scrollbar max-h-[360px] space-y-2 overflow-y-auto pr-1">
                      {slotsForDate.map((slot, idx) => {
                        const isChosen = selectedSlot?.startTime === slot.startTime;
                        return (
                          <button
                            key={idx}
                            className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium transition-all ${
                              isChosen
                                ? 'border-[var(--brand-soft-strong)] bg-white text-[var(--brand-dark)] shadow-[0_14px_24px_rgba(188,25,24,0.08)]'
                                : 'border-[var(--line)] bg-transparent text-slate-700 hover:border-[var(--brand-soft-strong)] hover:bg-white'
                            }`}
                            onClick={() => handleSlotClick(slot)}
                            type="button"
                          >
                            <Clock className="h-4 w-4 flex-shrink-0" />
                            <span>{formatTime12(slot.startTime)} - {formatTime12(slot.endTime)}</span>
                            {isChosen ? <CheckCircle className="ml-auto h-4 w-4 text-[var(--brand)]" /> : null}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {selectedSlot ? (
                    <div className="mt-6">
                      {error ? (
                        <div className="mb-3 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                          <AlertCircle className="h-4 w-4" />
                          <span>{error}</span>
                        </div>
                      ) : null}
                      <button
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand)] py-3 font-bold text-white shadow-[0_20px_40px_rgba(188,25,24,0.18)] transition-all hover:bg-[var(--brand-dark)] disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={booking || !hasValidLeadEmail}
                        onClick={handleBooking}
                        type="button"
                      >
                        {booking ? (
                          <Loader className="h-5 w-5 animate-spin" />
                        ) : (
                          <>
                            <CheckCircle className="h-5 w-5" />
                            Confirm Booking
                          </>
                        )}
                      </button>
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-[0_14px_28px_rgba(59,33,29,0.06)]">
                    <Calendar className="h-8 w-8 text-[var(--brand)]" />
                  </div>
                  <p className="max-w-[200px] text-sm text-slate-500">
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
