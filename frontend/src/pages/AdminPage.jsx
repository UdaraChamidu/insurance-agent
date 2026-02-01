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
  const ADMIN_PASSWORD = 'admin123'; // Change this in production!

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
    // In a real app, fetch from Microsoft Bookings API
    // For now, we'll use mock data
    setMeetings([
      {
        id: 'meeting-1',
        clientName: 'John Smith',
        email: 'john@example.com',
        date: '2024-01-15',
        time: '10:00 AM',
        type: 'Life Insurance',
        status: 'scheduled'
      },
      {
        id: 'meeting-2',
        clientName: 'Sarah Johnson',
        email: 'sarah@example.com',
        date: '2024-01-15',
        time: '2:00 PM',
        type: 'Auto Insurance',
        status: 'scheduled'
      }
    ]);
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
    navigate(`/admin/dashboard?meetingId=${meetingId}`);
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center">
        <div className="card max-w-md w-full">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <Lock className="h-16 w-16 text-blue-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Admin Login</h1>
            <p className="text-gray-600 mt-2">Enter password to access admin console</p>
          </div>

          <form onSubmit={handleLogin}>
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter admin password"
                required
              />
            </div>

            <button type="submit" className="w-full btn-primary">
              Login
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => navigate('/')}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              ← Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">Admin Console</h1>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/admin/bookings')}
                className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
              >
                <Calendar className="h-4 w-4" />
                <span>View Scheduled Meetings</span>
              </button>
              <button
                onClick={() => setShowCreateMeeting(true)}
                className="btn-primary"
              >
                Create Meeting Link
              </button>
              <button
                onClick={() => {
                  sessionStorage.removeItem('adminAuth');
                  setIsAuthenticated(false);
                }}
                className="btn-secondary"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Today's Meetings</p>
                <p className="text-3xl font-bold text-gray-900">2</p>
              </div>
              <Calendar className="h-12 w-12 text-blue-600 opacity-50" />
            </div>
          </div>
          
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active Clients</p>
                <p className="text-3xl font-bold text-gray-900">8</p>
              </div>
              <Users className="h-12 w-12 text-green-600 opacity-50" />
            </div>
          </div>
          
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">This Week</p>
                <p className="text-3xl font-bold text-gray-900">12</p>
              </div>
              <Video className="h-12 w-12 text-purple-600 opacity-50" />
            </div>
          </div>
        </div>

        {/* Upcoming Meetings */}
        <div className="card">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Upcoming Consultations</h2>
          
          {meetings.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Calendar className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p>No scheduled meetings</p>
            </div>
          ) : (
            <div className="space-y-4">
              {meetings.map((meeting) => (
                <div key={meeting.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                          <Users className="h-6 w-6 text-blue-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">{meeting.clientName}</h3>
                          <p className="text-sm text-gray-600">{meeting.email}</p>
                          <div className="flex items-center space-x-4 mt-1 text-sm text-gray-500">
                            <span>{meeting.date} at {meeting.time}</span>
                            <span>•</span>
                            <span>{meeting.type}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className="px-3 py-1 bg-green-100 text-green-800 text-sm font-medium rounded-full">
                        {meeting.status}
                      </span>
                      <button
                        onClick={() => joinMeeting(meeting.id)}
                        className="btn-primary flex items-center space-x-2"
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">Create Meeting Link</h2>
            <p className="text-gray-600 mb-6">
              Generate a unique meeting link to send to your client. They can join using this link.
            </p>
            <div className="flex space-x-3">
              <button
                onClick={createMeetingRoom}
                className="flex-1 btn-primary"
              >
                Generate Link
              </button>
              <button
                onClick={() => setShowCreateMeeting(false)}
                className="flex-1 btn-secondary"
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
