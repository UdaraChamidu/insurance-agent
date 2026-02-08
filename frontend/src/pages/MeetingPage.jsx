import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Video, Mic, MicOff, VideoOff, Phone, Download, Sparkles, MessageSquare } from 'lucide-react';
import meetingService from '../services/meetingService';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3001';

export default function MeetingPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const meetingId = searchParams.get('meetingId');
  const role = searchParams.get('role') || 'client';
  
  const [error, setError] = useState(null); // Add error state
  const [logs, setLogs] = useState([]); // Visual logs

  // Helper to add logs
  const addLog = (msg) => {
    console.log(msg);
    setLogs(prev => [...prev.slice(-10), `${new Date().toLocaleTimeString()} - ${msg}`]);
  };

  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [userName, setUserName] = useState('');
  const [isJoined, setIsJoined] = useState(false);
  const [transcriptions, setTranscriptions] = useState([]);
  const [aiSuggestions, setAiSuggestions] = useState([]);
  const [conversationHistory, setConversationHistory] = useState([]);
  const [isAIMonitoring, setIsAIMonitoring] = useState(false);
  const isMonitoringRef = useRef(false);
  
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  useEffect(() => {
    if (!meetingId) {
      navigate('/');
      return;
    }

    return () => {
      if (meetingService) {
        meetingService.leaveMeeting();
      }
    };
  }, [meetingId]);

  const handleJoinMeeting = async () => {
    if (!userName.trim()) {
      alert('Please enter your name');
      return;
    }

    try {
      // Connect to WebSocket
      addLog(`Connecting to WS: ${WS_URL}`);
      await meetingService.connect(WS_URL);
      addLog('WS Connected');
      
      // Set up callback for remote stream
      meetingService.onRemoteStream = (stream) => {
        addLog('📹 Remote stream received');
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = stream;
        }
      };
      
      // Set up callbacks for transcriptions and AI suggestions (admin only)
      if (role === 'admin') {
        meetingService.onTranscription = (data) => {
          if (!isMonitoringRef.current) return; // Use ref to get latest state
          
          addLog('📝 Transcription received');
          const entry = {
            text: data.text,
            timestamp: new Date().toLocaleTimeString()
          };
          setTranscriptions(prev => [...prev, entry]);
          setConversationHistory(prev => [...prev, {
            type: 'customer',
            text: data.text,
            timestamp: entry.timestamp
          }]);
        };
        
        meetingService.onAISuggestion = (data) => {
          if (!isMonitoringRef.current) return; // Use ref to get latest state
          
          addLog('💡 AI Suggestion received');
          const entry = {
            suggestion: data.suggestion,
            timestamp: new Date().toLocaleTimeString()
          };
          setAiSuggestions(prev => [...prev, entry]);
          setConversationHistory(prev => [...prev, {
            type: 'ai',
            text: data.suggestion,
            timestamp: entry.timestamp
          }]);
        };
      }
      
      // Join meeting (peer connections handled automatically)
      addLog(`Joining meeting: ${meetingId}`);
      const stream = await meetingService.joinMeeting(
        meetingId,
        `${role}-${userName.replace(/\s+/g, '-')}-${Date.now()}`,
        role
      );
      addLog('✅ Local stream acquired');
      
      // Set local video
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      
      setIsConnected(true);
      setIsJoined(true);
      // Monitoring off by default
      setIsAIMonitoring(false);
      isMonitoringRef.current = false;
    } catch (error) {
      addLog(`❌ Error: ${error.message}`);
      setError(error.message);
      alert('Failed to join meeting. Please check your camera and microphone permissions.');
    }
  };

  const toggleMute = () => {
    if (meetingService.localStream) {
      const audioTrack = meetingService.localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
        
        // Stop/start audio processing when muting/unmuting
        if (audioTrack.enabled) {
          meetingService.isRecording = true;
        } else {
          meetingService.isRecording = false;
        }
      }
    }
  };

  const toggleVideo = () => {
    if (meetingService.localStream) {
      const videoTrack = meetingService.localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
      }
    }
  };

  const endCall = () => {
    if (confirm('Are you sure you want to leave the consultation?')) {
      meetingService.leaveMeeting();
      navigate('/');
    }
  };

  const downloadConversation = () => {
    if (conversationHistory.length === 0) {
      alert('No conversation to download yet!');
      return;
    }

    // Create CSV content
    const csvContent = [
      ['Time', 'Type', 'Message'],
      ...conversationHistory.map(item => [
        item.timestamp,
        item.type === 'customer' ? 'Customer' : 'AI Suggestion',
        item.text.replace(/"/g, '""') // Escape quotes
      ])
    ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

    // Download
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `meeting-${meetingId}-${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!isJoined) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="card max-w-md w-full">
          <div className="text-center mb-8">
            <Video className="h-16 w-16 text-blue-600 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Join Consultation
            </h1>
            <p className="text-gray-600">
              You're about to join a video consultation with SecureLife Insurance
            </p>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Your Name
            </label>
            <input
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter your name"
              onKeyPress={(e) => e.key === 'Enter' && handleJoinMeeting()}
            />
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-blue-900 text-sm mb-2">Before joining:</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Make sure your camera and microphone are working</li>
              <li>• Find a quiet, well-lit space</li>
              <li>• Have any relevant documents ready</li>
            </ul>
          </div>

          <button
            onClick={handleJoinMeeting}
            className="w-full btn-primary text-lg py-3"
          >
            Join Meeting
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-black flex flex-col md:flex-row">
      {/* Main Video Area - Full height on mobile, flex-1 on desktop */}
      <div className={`flex-1 flex flex-col relative ${role === 'admin' ? 'h-[50vh] md:h-full' : 'h-full'}`}>
        {/* Header - Hidden on small mobile screens if needed, or compact */}
        <header className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/70 to-transparent px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <h1 className="text-sm md:text-lg font-semibold text-white truncate">Consultation</h1>
              {role === 'admin' && <span className="text-[10px] bg-blue-600 px-2 py-0.5 rounded text-white">Admin</span>}
            </div>
            <div className="text-xs md:text-sm text-gray-300">
              {userName}
            </div>
          </div>
        </header>

        {/* Video Section */}
        <div className="flex-1 relative bg-gray-900 overflow-hidden">
          {/* Remote Video */}
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
          
          {!isConnected && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-0">
              <div className="text-center text-gray-400 p-4">
                <Video className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-sm">Connecting...</p>
              </div>
            </div>
          )}

          {/* Local Video - PiP */}
          <div className="absolute bottom-20 right-4 w-32 h-24 md:bottom-24 md:right-6 md:w-64 md:h-48 bg-gray-800 rounded-lg overflow-hidden shadow-2xl border border-gray-700 z-10">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          </div>

          {/* Controls - Floating Bar */}
          <div className="absolute bottom-6 left-0 right-0 flex justify-center z-20 pointer-events-none">
            <div className="flex items-center space-x-4 bg-black/50 backdrop-blur-sm px-6 py-2 rounded-full pointer-events-auto">
              <button
                onClick={toggleMute}
                className={`p-4 rounded-full ${isMuted ? 'bg-red-600' : 'bg-gray-700'} hover:opacity-80 transition-all shadow-lg`}
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? <MicOff className="h-6 w-6 text-white" /> : <Mic className="h-6 w-6 text-white" />}
              </button>
              
              <button
                onClick={toggleVideo}
                className={`p-4 rounded-full ${isVideoOff ? 'bg-red-600' : 'bg-gray-700'} hover:opacity-80 transition-all shadow-lg`}
                title={isVideoOff ? 'Turn on camera' : 'Turn off camera'}
              >
                {isVideoOff ? <VideoOff className="h-6 w-6 text-white" /> : <Video className="h-6 w-6 text-white" />}
              </button>
              
              <button
                onClick={endCall}
                className="p-4 rounded-full bg-red-600 hover:bg-red-700 transition-all shadow-lg"
                title="Leave meeting"
              >
                <Phone className="h-6 w-6 text-white transform rotate-135" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Admin Panel - 3 Columns (50% width for more space) */}
      {role === 'admin' && (
        <div className="w-1/2 bg-gray-900 flex flex-col">
          <div className="px-4 py-3 bg-gray-800 border-b border-gray-700 flex justify-between items-center">
            <h2 className="text-sm font-semibold text-white">Admin Panel</h2>
            <div className="flex items-center space-x-3">
              <span className={`text-[10px] uppercase font-bold ${isAIMonitoring ? 'text-green-400' : 'text-gray-500'}`}>
                AI Feed: {isAIMonitoring ? 'Active' : 'Disabled'}
              </span>
              <button
                onClick={() => {
                  const newState = !isAIMonitoring;
                  setIsAIMonitoring(newState);
                  isMonitoringRef.current = newState;
                  // State is now preserved, no clearing here
                }}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                  isAIMonitoring ? 'bg-green-600' : 'bg-gray-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    isAIMonitoring ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
              <span className="text-[10px] text-white font-medium min-w-[60px]">
                {isAIMonitoring ? 'AI ACTIVE' : 'AI OFF'}
              </span>
            </div>
          </div>
          
          <div className="flex-1 flex overflow-hidden">
            {/* Column 1: Live Transcription */}
            <div className="flex-1 border-r border-gray-700 flex flex-col">
              <div className="px-3 py-2 bg-gray-800 border-b border-gray-700 flex justify-between items-center">
                <h3 className="text-xs font-semibold text-white flex items-center justify-between w-full">
                  <span>Live Transcription</span>
                  {!isAIMonitoring && <span className="text-[10px] text-gray-500 bg-gray-700 px-1 rounded animate-pulse">PAUSED</span>}
                </h3>
                <button 
                  onClick={() => {
                    if (transcriptions.length > 0) {
                      const lastEntry = transcriptions[transcriptions.length - 1];
                      meetingService.requestAISuggestion(meetingId, lastEntry.text, 'customer');
                    } else {
                      alert('No transcription available to analyze.');
                    }
                  }}
                  className="px-2 py-0.5 bg-purple-600 hover:bg-purple-700 text-white text-[10px] rounded flex items-center space-x-1 transition-colors"
                >
                  <span>Ask AI</span>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-2 relative">
                {transcriptions.length === 0 ? (
                  <div className="text-center text-gray-500 text-xs mt-4">
                    <p>{!isAIMonitoring ? 'Feed Paused' : 'Waiting for customer...'}</p>
                  </div>
                ) : (
                  transcriptions.map((item, index) => (
                    <div key={index} className="bg-gray-800 rounded p-2">
                      <div className="text-xs text-gray-400 mb-1">{item.timestamp}</div>
                      <div className="text-xs text-white">{item.text}</div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Column 2: AI Suggestions */}
            <div className="flex-1 border-r border-gray-700 flex flex-col">
              <div className="px-3 py-2 bg-gray-800 border-b border-gray-700">
                <h3 className="text-xs font-semibold text-white flex items-center justify-between w-full">
                  <div className="flex items-center">
                    <span className="mr-1">💡</span>
                    AI Suggestions
                  </div>
                  {!isAIMonitoring && <span className="text-[10px] text-gray-500 bg-gray-700 px-1 rounded animate-pulse">PAUSED</span>}
                </h3>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-2 relative">
                {aiSuggestions.length === 0 ? (
                  <div className="text-center text-gray-500 text-xs mt-4">
                    <p>{!isAIMonitoring ? 'Assistance Paused' : 'AI suggestions...'}</p>
                  </div>
                ) : (
                  aiSuggestions.map((item, index) => (
                    <div key={index} className="bg-blue-900 bg-opacity-30 border border-blue-700 rounded p-2">
                      <div className="text-xs text-blue-300 mb-1">{item.timestamp}</div>
                      <div className="text-xs text-white">{item.suggestion}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          
            {/* Column 3: Full Conversation */}
            <div className="flex-1 flex flex-col">
              <div className="px-3 py-2 bg-gray-800 border-b border-gray-700 flex justify-between items-center">
                <h3 className="text-xs font-semibold text-white">Full Chat</h3>
                <button
                  onClick={downloadConversation}
                  className="flex items-center space-x-1 px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs text-white transition"
                  title="Download conversation as CSV"
                >
                  <Download className="h-3 w-3" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-2 relative">
                {conversationHistory.length === 0 ? (
                  <div className="text-center text-gray-500 text-xs mt-4">
                    <p>{!isAIMonitoring ? 'History Hidden' : 'Chat will appear...'}</p>
                  </div>
                ) : (
                  conversationHistory.map((item, index) => (
                    <div
                      key={index}
                      className={`rounded p-2 ${
                        item.type === 'customer'
                          ? 'bg-gray-800'
                          : 'bg-blue-900 bg-opacity-30 border border-blue-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-xs font-semibold ${
                          item.type === 'customer' ? 'text-green-400' : 'text-blue-300'
                        }`}>
                          {item.type === 'customer' ? '👤' : '🤖'}
                        </span>
                        <span className="text-xs text-gray-400">{item.timestamp}</span>
                      </div>
                      <div className="text-xs text-white">{item.text}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
