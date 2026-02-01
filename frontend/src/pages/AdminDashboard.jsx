import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Video, Mic, MicOff, VideoOff, Phone, MessageSquare, Sparkles, Users } from 'lucide-react';
import meetingService from '../services/meetingService';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3001';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const meetingId = searchParams.get('meetingId');
  
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [transcriptions, setTranscriptions] = useState([]);
  const [aiSuggestions, setAiSuggestions] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [currentSuggestion, setCurrentSuggestion] = useState(null);
  
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const transcriptionEndRef = useRef(null);

  useEffect(() => {
    if (!meetingId) {
      navigate('/admin');
      return;
    }

    initializeMeeting();

    return () => {
      if (meetingService) {
        meetingService.leaveMeeting();
      }
    };
  }, [meetingId]);

  const initializeMeeting = async () => {
    try {
      // Connect to WebSocket
      await meetingService.connect(WS_URL);
      
      // Set up callbacks
      meetingService.onTranscription = (data) => {
        setTranscriptions(prev => [...prev, {
          id: Date.now(),
          userId: data.userId,
          text: data.text,
          timestamp: data.timestamp
        }]);
        
        // Auto-scroll to latest transcription
        setTimeout(() => {
          transcriptionEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      };
      
      meetingService.onAISuggestion = (data) => {
        const suggestion = {
          id: Date.now(),
          text: data.suggestion,
          relatedTo: data.relatedTo,
          timestamp: data.timestamp
        };
        
        setAiSuggestions(prev => [...prev, suggestion]);
        setCurrentSuggestion(suggestion);
        
        // Auto-clear current suggestion after 15 seconds
        setTimeout(() => {
          setCurrentSuggestion(null);
        }, 15000);
      };
      
      meetingService.onParticipantJoined = (data) => {
        setParticipants(data.participants || []);
      };
      
      meetingService.onParticipantLeft = (data) => {
        setParticipants(prev => prev.filter(p => p.userId !== data.userId));
      };
      
      meetingService.onRemoteStream = (stream) => {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = stream;
        }
      };
      
      // Join meeting as admin
      const stream = await meetingService.joinMeeting(
        meetingId,
        `admin-${Date.now()}`,
        'admin'
      );
      
      // Set local video
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      
      setIsConnected(true);
    } catch (error) {
      console.error('Error initializing meeting:', error);
      alert('Failed to join meeting. Please try again.');
    }
  };

  const toggleMute = () => {
    if (meetingService.localStream) {
      const audioTrack = meetingService.localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
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
    if (confirm('Are you sure you want to end the consultation?')) {
      meetingService.leaveMeeting();
      navigate('/admin');
    }
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <div className="h-screen bg-gray-900 flex flex-col">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h1 className="text-xl font-bold text-white">Admin Console</h1>
            <div className="flex items-center space-x-2 text-sm text-gray-400">
              <Users className="h-4 w-4" />
              <span>{participants.length} participant{participants.length !== 1 ? 's' : ''}</span>
            </div>
          </div>
          <div className="text-sm text-gray-400">
            Meeting ID: {meetingId}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Video Section */}
        <div className="flex-1 flex flex-col bg-black">
          {/* Remote Video (Client) */}
          <div className="flex-1 relative">
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
            {!isConnected && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                <div className="text-center text-gray-400">
                  <Video className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <p>Waiting for client to join...</p>
                </div>
              </div>
            )}
          </div>

          {/* Local Video (Admin) */}
          <div className="absolute bottom-20 right-6 w-64 h-48 bg-gray-800 rounded-lg overflow-hidden shadow-2xl border-2 border-gray-700">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            <div className="absolute bottom-2 left-2 bg-black bg-opacity-60 px-2 py-1 rounded text-xs text-white">
              You (Admin)
            </div>
          </div>

          {/* AI Suggestion Overlay */}
          {currentSuggestion && (
            <div className="absolute top-6 left-6 right-6 bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg p-4 shadow-2xl animate-pulse">
              <div className="flex items-start space-x-3">
                <Sparkles className="h-6 w-6 text-white flex-shrink-0 mt-1" />
                <div className="flex-1">
                  <div className="text-sm font-semibold text-white mb-1">AI Suggestion</div>
                  <p className="text-white text-sm">{currentSuggestion.text}</p>
                </div>
                <button
                  onClick={() => setCurrentSuggestion(null)}
                  className="text-white hover:text-gray-200"
                >
                  ×
                </button>
              </div>
            </div>
          )}

          {/* Controls */}
          <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex items-center space-x-4">
            <button
              onClick={toggleMute}
              className={`p-4 rounded-full ${isMuted ? 'bg-red-600' : 'bg-gray-700'} hover:opacity-80 transition-all`}
            >
              {isMuted ? <MicOff className="h-6 w-6 text-white" /> : <Mic className="h-6 w-6 text-white" />}
            </button>
            
            <button
              onClick={toggleVideo}
              className={`p-4 rounded-full ${isVideoOff ? 'bg-red-600' : 'bg-gray-700'} hover:opacity-80 transition-all`}
            >
              {isVideoOff ? <VideoOff className="h-6 w-6 text-white" /> : <Video className="h-6 w-6 text-white" />}
            </button>
            
            <button
              onClick={endCall}
              className="p-4 rounded-full bg-red-600 hover:bg-red-700 transition-all"
            >
              <Phone className="h-6 w-6 text-white transform rotate-135" />
            </button>
          </div>
        </div>

        {/* Right Sidebar - Transcription & AI */}
        <div className="w-96 bg-gray-800 flex flex-col">
          {/* Tabs */}
          <div className="flex border-b border-gray-700">
            <button className="flex-1 px-4 py-3 text-white bg-gray-700 font-medium flex items-center justify-center space-x-2">
              <MessageSquare className="h-4 w-4" />
              <span>Live Transcription</span>
            </button>
          </div>

          {/* Transcription Feed */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {transcriptions.length === 0 ? (
              <div className="text-center text-gray-500 mt-8">
                <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Transcription will appear here</p>
              </div>
            ) : (
              transcriptions.map((item) => (
                <div key={item.id} className="bg-gray-700 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-blue-400">
                      {item.userId.startsWith('admin') ? 'You' : 'Client'}
                    </span>
                    <span className="text-xs text-gray-400">
                      {formatTime(item.timestamp)}
                    </span>
                  </div>
                  <p className="text-sm text-white">{item.text}</p>
                </div>
              ))
            )}
            <div ref={transcriptionEndRef} />
          </div>

          {/* AI Suggestions History */}
          <div className="border-t border-gray-700 p-4">
            <div className="flex items-center space-x-2 mb-3">
              <Sparkles className="h-4 w-4 text-purple-400" />
              <h3 className="text-sm font-semibold text-white">Recent AI Suggestions</h3>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {aiSuggestions.slice(-5).reverse().map((suggestion) => (
                <div key={suggestion.id} className="bg-gray-700 rounded p-2">
                  <p className="text-xs text-gray-300">{suggestion.text}</p>
                  <span className="text-xs text-gray-500 mt-1 block">
                    {formatTime(suggestion.timestamp)}
                  </span>
                </div>
              ))}
              {aiSuggestions.length === 0 && (
                <p className="text-xs text-gray-500">No suggestions yet</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
