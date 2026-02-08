import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Video, Lock, Users } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function AdminPage() {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [meetings, setMeetings] = useState([]);
  const [showCreateMeeting, setShowCreateMeeting] = useState(false);

  // Simple password check (In production, use proper authentication)
  const ADMIN_PASSWORD = localStorage.getItem('adminPassword') || 'admin123'; // Dynamic check

  const handleLogin = (e) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      sessionStorage.setItem('adminAuth', 'true');
      loadMeetings();
    } else {
      alert('Invalid password');
    }
  };

  useEffect(() => {
    // Check if already authenticated
    if (sessionStorage.getItem('adminAuth') === 'true') {
      setIsAuthenticated(true);
      loadMeetings();
    }
  }, []);

  const loadMeetings = async () => {
    try {
      console.log('📅 Loading real appointments from Microsoft Bookings...');
      
      // Fetch real appointments from the API
      const response = await fetch(`${API_URL}/api/bookings/appointments`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('📦 Raw API Response:', data);

      // Handle different response structures (Array vs { value: [] } vs undefined)
      let appointmentsList = [];
      if (Array.isArray(data)) {
        appointmentsList = data;
      } else if (data && Array.isArray(data.value)) {
        appointmentsList = data.value;
      } else if (data && Array.isArray(data.appointments)) {
         appointmentsList = data.appointments;
      } else {
        console.warn('⚠️ API returned unexpected format:', data);
      }
      
      console.log(`✅ Loaded ${appointmentsList.length} appointments`);
      
      // Transform appointments to match our UI structure
      const transformedMeetings = appointmentsList.map(apt => ({
        id: apt.id,
        clientName: apt.customerName || 'Unknown',
        email: apt.customerEmailAddress || 'N/A',
        date: new Date(apt.startDateTime?.dateTime || apt.startDateTime).toLocaleDateString(),
        time: new Date(apt.startDateTime?.dateTime || apt.startDateTime).toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        }),
        type: apt.serviceName || 'Consultation',
        status: 'scheduled'
      }));
      
      setMeetings(transformedMeetings);
    } catch (error) {
      console.error('Error loading meetings:', error);
      // If API fails, use empty array
      setMeetings([]);
    }
  };

  const createMeetingRoom = async () => {
    try {
      const response = await fetch(`${API_URL}/api/meetings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      });
      
      const data = await response.json();
      const meetingLink = `${window.location.origin}/meeting?meetingId=${data.meetingId}&role=client`;
      
      // Copy to clipboard
      navigator.clipboard.writeText(meetingLink);
      alert(`Meeting link created and copied to clipboard!\n\n${meetingLink}`);
      
      setShowCreateMeeting(false);
    } catch (error) {
      console.error('Error creating meeting:', error);
      alert('Failed to create meeting');
    }
  };

  const joinMeeting = (meetingId) => {
    navigate(`/meeting?meetingId=${meetingId}&role=admin`);
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-8 max-w-md w-full shadow-2xl">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <div className="bg-blue-600/20 p-3 rounded-full">
                <Lock className="h-10 w-10 text-blue-400" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-white">Admin Login</h1>
            <p className="text-gray-400 mt-2">Enter password to access admin console</p>
          </div>

          <form onSubmit={handleLogin}>
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="Enter admin password"
                required
              />
            </div>

            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 px-6 rounded-lg transition-all shadow-lg shadow-blue-600/20">
              Login
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => navigate('/')}
              className="text-sm text-blue-300 hover:text-blue-200 transition-colors"
            >
              ← Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gradient-to-br dark:from-slate-900 dark:via-blue-900 dark:to-slate-900 transition-colors duration-300">
      {/* Header */}
      <header className="bg-white dark:bg-black/30 backdrop-blur-md border-b border-gray-200 dark:border-white/10 sticky top-0 z-10 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Admin Console</h1>
            <div className="flex flex-col md:flex-row items-center gap-3 w-full md:w-auto">
              <button
                onClick={() => navigate('/admin/bookings')}
                className="w-full md:w-auto flex items-center justify-center space-x-2 px-4 py-2 bg-purple-600/80 hover:bg-purple-500 text-white rounded-lg transition-all border border-purple-500/30"
              >
                <Calendar className="h-4 w-4" />
                <span>View Scheduled Meetings</span>
              </button>
              <button
                onClick={() => setShowCreateMeeting(true)}
                className="w-full md:w-auto bg-blue-600 hover:bg-blue-500 text-white font-medium py-2 px-4 rounded-lg transition-all"
              >
                Create Meeting Link
              </button>
              <button
                onClick={() => {
                  sessionStorage.removeItem('adminAuth');
                  setIsAuthenticated(false);
                }}
                className="w-full md:w-auto bg-white/10 hover:bg-white/20 text-white border border-white/10 py-2 px-4 rounded-lg transition-all"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Today's Meetings</p>
                <p className="text-3xl font-bold text-white">
                  {meetings.filter(m => m.date === new Date().toLocaleDateString()).length}
                </p>
              </div>
              <div className="bg-blue-500/20 p-3 rounded-lg">
                <Calendar className="h-8 w-8 text-blue-400" />
              </div>
            </div>
          </div>
          
          <div className="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Total Scheduled</p>
                <p className="text-3xl font-bold text-white">{meetings.length}</p>
              </div>
              <div className="bg-green-500/20 p-3 rounded-lg">
                <Users className="h-8 w-8 text-green-400" />
              </div>
            </div>
          </div>
          
          <div className="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Consultations</p>
                <p className="text-3xl font-bold text-white">
                  {meetings.filter(m => m.type.includes('Consultation')).length || meetings.length}
                </p>
              </div>
              <div className="bg-purple-500/20 p-3 rounded-lg">
                <Video className="h-8 w-8 text-purple-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Upcoming Meetings */}
        {/* Upcoming Meetings */}
        <div className="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 p-6">
          <h2 className="text-xl font-bold text-white mb-6">Upcoming Consultations</h2>
          
          {meetings.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Calendar className="h-16 w-16 mx-auto mb-4 opacity-30" />
              <p>No scheduled meetings</p>
            </div>
          ) : (
            <div className="space-y-4">
              {meetings.map((meeting) => (
                <div key={meeting.id} className="bg-black/20 border border-white/10 rounded-lg p-4 hover:bg-black/30 transition-colors">
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div className="flex-1 w-full">
                      <div className="flex items-start md:items-center space-x-4">
                        <div className="w-12 h-12 bg-blue-600/20 rounded-full flex items-center justify-center flex-shrink-0">
                          <Users className="h-6 w-6 text-blue-400" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-white">{meeting.clientName}</h3>
                          <p className="text-sm text-gray-400 break-all">{meeting.email}</p>
                          <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-gray-500">
                            <span className="text-gray-300">{meeting.date} at {meeting.time}</span>
                            <span className="hidden md:inline text-gray-600">•</span>
                            <span className="text-blue-300">{meeting.type}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3 w-full md:w-auto justify-between md:justify-end">
                      <span className="px-3 py-1 bg-green-900/30 text-green-400 border border-green-500/30 text-sm font-medium rounded-full">
                        {meeting.status}
                      </span>
                      <button
                        onClick={() => joinMeeting(meeting.id)}
                        className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg flex items-center space-x-2 flex-1 md:flex-none justify-center transition-all shadow-lg shadow-blue-600/20"
                      >
                        <Video className="h-4 w-4" />
                        <span>Join Meeting</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Create Meeting Modal */}
      {showCreateMeeting && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <h2 className="text-xl font-bold text-white mb-4">Create Meeting Link</h2>
            <p className="text-gray-400 mb-6">
              Generate a unique meeting link to send to your client. They can join using this link.
            </p>
            <div className="flex space-x-3">
              <button
                onClick={createMeetingRoom}
                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-medium py-2 px-4 rounded-lg transition-all"
              >
                Generate Link
              </button>
              <button
                onClick={() => setShowCreateMeeting(false)}
                className="flex-1 bg-white/10 hover:bg-white/20 text-white border border-white/10 font-medium py-2 px-4 rounded-lg transition-all"
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
