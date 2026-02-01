import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Video, Mic, MicOff, VideoOff, Phone } from 'lucide-react';
import meetingService from '../services/meetingService';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3001';

export default function MeetingPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const meetingId = searchParams.get('meetingId');
  const role = searchParams.get('role') || 'client';
  
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [userName, setUserName] = useState('');
  const [isJoined, setIsJoined] = useState(false);
  
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
      await meetingService.connect(WS_URL);
      
      // Set up callbacks
      meetingService.onRemoteStream = (stream) => {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = stream;
        }
      };
      
      // Join meeting as client
      const stream = await meetingService.joinMeeting(
        meetingId,
        `client-${userName.replace(/\s+/g, '-')}-${Date.now()}`,
        role
      );
      
      // Set local video
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      
      setIsConnected(true);
      setIsJoined(true);
    } catch (error) {
      console.error('Error joining meeting:', error);
      alert('Failed to join meeting. Please check your camera and microphone permissions.');
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
    if (confirm('Are you sure you want to leave the consultation?')) {
      meetingService.leaveMeeting();
      navigate('/');
    }
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
    <div className="h-screen bg-black flex flex-col">
      {/* Header */}
      <header className="bg-gray-900 px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h1 className="text-lg font-semibold text-white">SecureLife Insurance - Consultation</h1>
          </div>
          <div className="text-sm text-gray-400">
            {userName}
          </div>
        </div>
      </header>

      {/* Video Section */}
      <div className="flex-1 relative">
        {/* Remote Video (Agent) */}
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
              <p>Connecting to agent...</p>
            </div>
          </div>
        )}

        {/* Local Video (Client) */}
        <div className="absolute bottom-24 right-6 w-64 h-48 bg-gray-800 rounded-lg overflow-hidden shadow-2xl border-2 border-gray-700">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          <div className="absolute bottom-2 left-2 bg-black bg-opacity-60 px-2 py-1 rounded text-xs text-white">
            You
          </div>
        </div>

        {/* Controls */}
        <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex items-center space-x-4">
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
  );
}
