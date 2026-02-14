import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Clock, User, Mail, Phone, FileText, Send, CheckCircle, XCircle, Loader, ArrowLeft, Filter, Bell, Database, Activity, HardDrive, ChevronRight, X } from 'lucide-react';
import bookingsService from '../services/bookingsService';
import emailjs from '@emailjs/browser';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function BookingsPage() {
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('upcoming'); // upcoming, past, all, invitation_sent
  const [searchTerm, setSearchTerm] = useState('');
  const [sendingInvitation, setSendingInvitation] = useState({});
  const [invitationStatus, setInvitationStatus] = useState(() => {
    // Load sent invitations from local storage
    const saved = localStorage.getItem('invitationStatus');
    return saved ? JSON.parse(saved) : {};
  });

  // Knowledge Base status bar state
  const [docStats, setDocStats] = useState(null);
  const [showKBBar, setShowKBBar] = useState(true);

  const fetchDocStats = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/documents/stats`);
      if (res.ok) setDocStats(await res.json());
    } catch (e) { /* non-critical */ }
  }, []);

  useEffect(() => {
    fetchDocStats();
    const interval = setInterval(fetchDocStats, 30000);
    return () => clearInterval(interval);
  }, [fetchDocStats]);

  const fetchAppointments = async () => {
    setLoading(true);
    try {
      const filters = {};
      
      if (filter === 'upcoming') {
        // filter handled in frontend to support all backends
      } else if (filter === 'past') {
        // filter handled in frontend
      }

      const data = await bookingsService.getAppointments(filters);
      setAppointments(data);
    } catch (error) {
      console.error('Error loading appointments:', error);
      alert('Failed to load appointments. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  const [successModal, setSuccessModal] = useState({ show: false, email: '', phone: null, link: '' });

  useEffect(() => {
    fetchAppointments();
  }, [filter]);

  const handleSendInvitation = async (appointmentId) => {
    // Get EmailJS credentials from environment variables
    const SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID;
    const TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
    const PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

    if (!SERVICE_ID || !TEMPLATE_ID || !PUBLIC_KEY) {
      alert('EmailJS credentials missing in .env file!');
      console.error('Missing credentials:', { SERVICE_ID, TEMPLATE_ID, PUBLIC_KEY });
      return;
    }

    setSendingInvitation(prev => ({ ...prev, [appointmentId]: true }));
    try {
      // 1. Get appointment details
      const appointment = appointments.find(a => a.id === appointmentId);
      if (!appointment) throw new Error('Appointment not found');

      // 2. Generate Meeting Link (Frontend side)
      // Format: http://localhost:5173/meeting?meetingId=UUID&role=client
      const meetingId = appointment.id;
      // Encode the ID to handle special characters (like Microsoft Graph IDs) safely
      const encodedId = encodeURIComponent(meetingId);
      const meetingLink = `${window.location.origin}/meeting?meetingId=${encodedId}&role=client`;

      // 3. Send Email using EmailJS
      // Matching variables from your template screenshot:
      // {{to_email}}, {{customer_name}}, {{meeting_time}}, {{meeting_id}}, {{passcode}}, {{join_link}}, {{description}}, {{email}}
      
      const dateStr = bookingsService.formatDate(appointment.startDateTime);
      const timeStr = bookingsService.formatTime(appointment.startDateTime);
      
      const emailParams = {
        // Recipient Mapping
        to_email: appointment.customerEmailAddress,
        email: 'agent@securelife.com', // For "Reply To" field (or put agent's email here)
        
        // Content Mapping
        customer_name: appointment.customerName,
        meeting_time: `${dateStr} at ${timeStr}`,
        meeting_id: meetingId,
        passcode: 'No Passcode Required', // Or 'Direct Link'
        join_link: meetingLink,
        description: appointment.serviceName || 'Insurance Consultation',
        
        // Keep old ones just in case
        date: dateStr,
        time: timeStr,
        service_name: appointment.serviceName
      };

      console.log('Sending email with params:', emailParams);
      await emailjs.send(SERVICE_ID, TEMPLATE_ID, emailParams, PUBLIC_KEY);

      let smsSent = false;

      // 4. Send SMS (if phone number exists)
      if (appointment.customerPhone) {
        try {
          const smsMessage = `Hello ${appointment.customerName}, your meeting is scheduled for ${dateStr} at ${timeStr}. Join here: ${meetingLink}`;
          await fetch(`${API_URL}/api/send-sms`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: appointment.customerPhone,
              message: smsMessage
            })
          });
          console.log('📱 SMS sent successfully');
          smsSent = true;
        } catch (smsError) {
          console.error('Failed to send SMS:', smsError);
          // Don't alert user about SMS failure if email succeeded, checking console is enough
        }
      }

      // 5. Update UI
      setInvitationStatus(prev => {
        const newState = { ...prev, [appointmentId]: true };
        localStorage.setItem('invitationStatus', JSON.stringify(newState));
        return newState;
      });
      
      // Show Success Modal instead of alert
      setSuccessModal({
        show: true,
        email: appointment.customerEmailAddress,
        phone: smsSent ? appointment.customerPhone : null,
        link: meetingLink
      });

    } catch (error) {
      console.error('Error sending invitation:', error);
      alert(`Failed to send invitation: ${error.text || error.message}`);
    } finally {
      setSendingInvitation(prev => ({ ...prev, [appointmentId]: false }));
    }
  };

  const handleJoinMeeting = (appointment) => {
    // Navigate to the Meeting Page (Unified UI) as Admin
    navigate(`/meeting?meetingId=${encodeURIComponent(appointment.id)}&role=admin`);
  };

  const filteredAppointments = appointments.filter(apt => {
    const searchLower = searchTerm.toLowerCase();
    const apptDate = new Date(apt.startDateTime);
    const now = new Date();
    
    // 1. Category Filter
    let matchesCategory = true;
    if (filter === 'upcoming') {
      matchesCategory = apptDate >= now;
    } else if (filter === 'past') {
      matchesCategory = apptDate < now;
    } else if (filter === 'invitation_sent') {
      matchesCategory = invitationStatus[apt.id];
    }
    // 'all' matches everything
    
    // 2. Search Filter
    const matchesSearch = (
      apt.customerName.toLowerCase().includes(searchLower) ||
      apt.customerEmailAddress.toLowerCase().includes(searchLower) ||
      apt.serviceName.toLowerCase().includes(searchLower) ||
      (apt.customerPhone && apt.customerPhone.includes(searchLower))
    );
    
    return matchesCategory && matchesSearch;
  });

  const getStatusColor = (status) => {
    switch (status) {
      case 'confirmed': return 'bg-green-100 text-green-800 border-green-300';
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'completed': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'cancelled': return 'bg-red-100 text-red-800 border-red-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'confirmed': return <CheckCircle className="h-4 w-4" />;
      case 'pending': return <Clock className="h-4 w-4" />;
      case 'completed': return <CheckCircle className="h-4 w-4" />;
      case 'cancelled': return <XCircle className="h-4 w-4" />;
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gradient-to-br dark:from-slate-900 dark:via-blue-900 dark:to-slate-900 transition-colors duration-300">
      {/* Header */}
      <header className="bg-white dark:bg-black/30 backdrop-blur-md border-b border-gray-200 dark:border-white/10 sticky top-0 z-10 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center space-x-4 w-full md:w-auto">
              <button
                onClick={() => navigate('/')}
                className="text-gray-600 dark:text-white hover:text-blue-600 dark:hover:text-blue-300 transition"
              >
                <ArrowLeft className="h-6 w-6" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Scheduled Meetings</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">Manage your appointments and consultations</p>
              </div>
            </div>
            <div className="flex items-center space-x-4 w-full md:w-auto justify-end">
              <button
                className="p-2 text-gray-400 dark:text-gray-300 hover:text-gray-600 dark:hover:text-white transition-colors relative"
                title="Notifications"
              >
                <Bell className="h-6 w-6" />
                <span className="absolute top-1 right-1 h-2 w-2 bg-red-500 rounded-full"></span>
              </button>
              
              <button
                onClick={() => navigate('/admin/profile')}
                className="p-2 text-gray-400 dark:text-gray-300 hover:text-gray-600 dark:hover:text-white transition-colors"
                title="Admin Profile"
              >
                <User className="h-6 w-6" />
              </button>

              <div className="h-8 w-px bg-gray-300 dark:bg-white/10 mx-2"></div>

              <button
                onClick={fetchAppointments}
                className="p-2 bg-gray-200 dark:bg-white/10 hover:bg-gray-300 dark:hover:bg-white/20 rounded-lg text-gray-700 dark:text-white transition-all flex items-center gap-2"
                title="Refresh Appointments"
              >
                <Loader className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
                <span className="hidden md:inline">Refresh</span>
              </button>
              
              <div className="hidden md:block px-4 py-2 bg-blue-100 dark:bg-blue-600/20 rounded-lg border border-blue-200 dark:border-blue-500/30">
                <div className="text-xs text-blue-600 dark:text-blue-300">Total Appointments</div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{filteredAppointments.length}</div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Knowledge Base Status Bar */}
      {showKBBar && docStats && (
        <div className="bg-gradient-to-r from-blue-900/40 via-purple-900/30 to-blue-900/40 border-b border-white/5">
          <div className="max-w-7xl mx-auto px-6 py-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-5 overflow-x-auto">
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Database className="h-4 w-4 text-blue-400" />
                  <span className="text-xs font-semibold text-blue-300 uppercase tracking-wider">Knowledge Base</span>
                </div>

                <div className="h-4 w-px bg-white/10 flex-shrink-0" />

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <div className={`h-2 w-2 rounded-full ${docStats.ingestion?.isRunning ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
                  <span className={`text-xs font-medium ${docStats.ingestion?.isRunning ? 'text-emerald-400' : 'text-red-400'}`}>
                    {docStats.ingestion?.isRunning ? 'Syncing' : 'Stopped'}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <FileText className="h-3.5 w-3.5 text-gray-400" />
                  <span className="text-xs text-gray-300">
                    <span className="font-bold text-white">{docStats.ingestion?.processedFileCount || 0}</span> files
                  </span>
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <HardDrive className="h-3.5 w-3.5 text-gray-400" />
                  <span className="text-xs text-gray-300">
                    <span className="font-bold text-white">{(docStats.pinecone?.totalVectors || 0).toLocaleString()}</span> vectors
                  </span>
                </div>

                {(docStats.ingestion?.errors?.length || 0) > 0 && (
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <XCircle className="h-3.5 w-3.5 text-red-400" />
                    <span className="text-xs text-red-300 font-medium">
                      {docStats.ingestion.errors.length} error(s)
                    </span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => navigate('/admin/documents')}
                  className="flex items-center gap-1 text-xs text-blue-300 hover:text-blue-200 transition-colors font-medium"
                >
                  View All <ChevronRight className="h-3 w-3" />
                </button>
                <button
                  onClick={() => setShowKBBar(false)}
                  className="text-gray-500 hover:text-gray-300 transition-colors ml-1"
                  title="Dismiss"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between mb-6">
          {/* Filter buttons */}
          <div className="flex flex-wrap gap-2">
            {['upcoming', 'past', 'all', 'invitation_sent'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  filter === f
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/50'
                    : 'bg-white/10 text-gray-300 hover:bg-white/20'
                }`}
              >
                {f === 'invitation_sent' ? 'Invitation Sent' : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="w-full md:flex-1 md:max-w-md">
            <input
              type="text"
              placeholder="Search by name, email, or service..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Loading state */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader className="h-12 w-12 text-blue-400 animate-spin" />
          </div>
        ) : filteredAppointments.length === 0 ? (
          <div className="text-center py-20">
            <Calendar className="h-16 w-16 text-gray-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">No appointments found</h3>
            <p className="text-gray-400">Try adjusting your filters or search term</p>
          </div>
        ) : (
          /* Appointments grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredAppointments.map((appointment) => (
              <div
                key={appointment.id}
                className="bg-white dark:bg-white/10 backdrop-blur-md rounded-xl border border-gray-200 dark:border-white/20 p-6 hover:shadow-xl dark:hover:bg-white/15 transition-all shadow-sm"
              >
                {/* Status badge */}
                <div className="flex items-center justify-between mb-4">
                  <div className={`flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(appointment.status)}`}>
                    {getStatusIcon(appointment.status)}
                    <span>{appointment.status.toUpperCase()}</span>
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {bookingsService.getRelativeTime(appointment.startDateTime)}
                  </div>
                </div>

                {/* Service name */}
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3">{appointment.serviceName}</h3>

                {/* Date and time */}
                <div className="space-y-2 mb-4">
                  <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-300">
                    <Calendar className="h-4 w-4 text-blue-500 dark:text-blue-400" />
                    <span>{bookingsService.formatDate(appointment.startDateTime)}</span>
                  </div>
                  <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-300">
                    <Clock className="h-4 w-4 text-blue-500 dark:text-blue-400" />
                    <span>
                      {bookingsService.formatTime(appointment.startDateTime)} - {bookingsService.formatTime(appointment.endDateTime)}
                      {' '}({bookingsService.calculateDuration(appointment.startDateTime, appointment.endDateTime)} min)
                    </span>
                  </div>
                </div>

                {/* Customer info */}
                <div className="border-t border-gray-200 dark:border-white/10 pt-4 mb-4 space-y-2">
                  <div className="flex items-center space-x-2 text-sm text-gray-700 dark:text-gray-300">
                    <User className="h-4 w-4 text-green-500 dark:text-green-400" />
                    <span className="font-medium">{appointment.customerName}</span>
                  </div>
                  <div className="flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400">
                    <Mail className="h-3 w-3" />
                    <span className="truncate">{appointment.customerEmailAddress}</span>
                  </div>
                  <div className="flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400">
                    <Phone className="h-3 w-3" />
                    <span>{appointment.customerPhone}</span>
                  </div>
                </div>

                {/* Notes */}
                {appointment.customerNotes && (
                  <div className="bg-gray-50 dark:bg-black/20 rounded-lg p-3 mb-4 border border-gray-100 dark:border-white/5">
                    <div className="flex items-start space-x-2">
                      <FileText className="h-4 w-4 text-purple-500 dark:text-purple-400 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-gray-600 dark:text-gray-300">{appointment.customerNotes}</p>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleSendInvitation(appointment.id)}
                    disabled={sendingInvitation[appointment.id]}
                    className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-all shadow-md hover:shadow-lg shadow-blue-500/20"
                  >
                    {sendingInvitation[appointment.id] ? (
                      <>
                        <Loader className="h-4 w-4 animate-spin" />
                        <span>Sending...</span>
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4" />
                        <span>Send Invite</span>
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => handleJoinMeeting(appointment)}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-all shadow-md hover:shadow-lg shadow-green-500/20"
                  >
                    Join
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Success Modal */}
      {successModal.show && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 border border-green-500/30 p-8 rounded-2xl shadow-2xl max-w-lg w-full relative animate-fadeIn">
            <button 
              onClick={() => setSuccessModal({ ...successModal, show: false })}
              className="absolute top-4 right-4 text-gray-400 hover:text-white"
            >
              <XCircle className="h-6 w-6" />
            </button>
            
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mb-6">
                <CheckCircle className="h-10 w-10 text-green-400" />
              </div>
              
              <h2 className="text-2xl font-bold text-white mb-2">Invitation Sent!</h2>
              <p className="text-gray-300 mb-6">
                The meeting details have been successfully delivered.
              </p>
              
              <div className="bg-white/5 rounded-xl p-4 w-full space-y-3 mb-6">
                <div className="flex items-center gap-3 text-sm">
                  <Mail className="h-5 w-5 text-blue-400" />
                  <span className="text-gray-300">Email sent to:</span>
                  <span className="text-white font-medium ml-auto truncate max-w-[200px]">{successModal.email}</span>
                </div>
                
                {successModal.phone && (
                  <div className="flex items-center gap-3 text-sm border-t border-white/10 pt-3">
                    <Phone className="h-5 w-5 text-green-400" />
                    <span className="text-gray-300">SMS sent to:</span>
                    <span className="text-white font-medium ml-auto">{successModal.phone}</span>
                  </div>
                )}
              </div>
              
              <div className="w-full">
                <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2 text-left">Meeting Link</label>
                <div className="bg-black/50 p-3 rounded-lg border border-white/10 flex items-center justify-between group">
                  <code className="text-blue-300 text-sm truncate mr-4">{successModal.link}</code>
                  <button 
                    onClick={() => navigator.clipboard.writeText(successModal.link)}
                    className="text-gray-400 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Copy Link"
                  >
                    <FileText className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <button
                onClick={() => setSuccessModal({ ...successModal, show: false })}
                className="mt-8 px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium transition-all w-full"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
