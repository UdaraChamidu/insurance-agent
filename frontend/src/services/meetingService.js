import SimplePeer from 'simple-peer';

class MeetingService {
  constructor() {
    this.ws = null;
    this.peer = null;
    this.localStream = null;
    this.remoteStream = null;
    this.meetingId = null;
    this.userId = null;
    this.role = null;
    this.audioContext = null;
    this.audioProcessor = null;
    this.isRecording = false;
    
    // Callbacks
    this.onTranscription = null;
    this.onAISuggestion = null;
    this.onParticipantJoined = null;
    this.onParticipantLeft = null;
    this.onRemoteStream = null;
  }

  connect(wsUrl) {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(wsUrl);
      
      this.ws.onopen = () => {
        console.log('WebSocket connected');
        resolve();
      };
      
      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        reject(error);
      };
      
      this.ws.onmessage = (event) => {
        this.handleMessage(JSON.parse(event.data));
      };
      
      this.ws.onclose = () => {
        console.log('WebSocket disconnected');
        this.cleanup();
      };
    });
  }

  handleMessage(data) {
    switch (data.type) {
      case 'joined-meeting':
        console.log('Joined meeting:', data);
        break;
      
      case 'participant-joined':
        console.log('Participant joined:', data);
        if (this.onParticipantJoined) {
          this.onParticipantJoined(data);
        }
        break;
      
      case 'participant-left':
        console.log('Participant left:', data);
        if (this.onParticipantLeft) {
          this.onParticipantLeft(data);
        }
        break;
      
      case 'offer':
        this.handleOffer(data);
        break;
      
      case 'answer':
        this.handleAnswer(data);
        break;
      
      case 'ice-candidate':
        this.handleIceCandidate(data);
        break;
      
      case 'transcription':
        console.log('Transcription received:', data);
        if (this.onTranscription) {
          this.onTranscription(data);
        }
        break;
      
      case 'ai-suggestion':
        console.log('AI suggestion received:', data);
        if (this.onAISuggestion) {
          this.onAISuggestion(data);
        }
        break;
      
      case 'error':
        console.error('Server error:', data.message);
        break;
    }
  }

  async joinMeeting(meetingId, userId, role) {
    this.meetingId = meetingId;
    this.userId = userId;
    this.role = role;
    
    // Get user media
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000
        }
      });
      
      // Start audio processing for transcription
      this.startAudioProcessing();
      
      // Send join message
      this.send({
        type: 'join-meeting',
        meetingId,
        userId,
        role
      });
      
      return this.localStream;
    } catch (error) {
      console.error('Error getting user media:', error);
      throw error;
    }
  }

  startAudioProcessing() {
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const source = this.audioContext.createMediaStreamSource(this.localStream);
    
    // Create script processor for audio chunks
    this.audioProcessor = this.audioContext.createScriptProcessor(4096, 1, 1);
    
    let audioChunks = [];
    let chunkCount = 0;
    const CHUNKS_PER_SECOND = Math.floor(this.audioContext.sampleRate / 4096);
    const SEND_INTERVAL = CHUNKS_PER_SECOND * 2; // Send every 2 seconds
    
    this.audioProcessor.onaudioprocess = (e) => {
      if (!this.isRecording) return;
      
      const inputData = e.inputBuffer.getChannelData(0);
      const audioData = new Float32Array(inputData);
      audioChunks.push(audioData);
      chunkCount++;
      
      // Send audio chunks every 2 seconds
      if (chunkCount >= SEND_INTERVAL) {
        this.sendAudioChunk(audioChunks);
        audioChunks = [];
        chunkCount = 0;
      }
    };
    
    source.connect(this.audioProcessor);
    this.audioProcessor.connect(this.audioContext.destination);
    this.isRecording = true;
  }

  sendAudioChunk(audioChunks) {
    // Combine chunks
    const totalLength = audioChunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const combined = new Float32Array(totalLength);
    let offset = 0;
    
    for (const chunk of audioChunks) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }
    
    // Convert Float32Array to Int16Array (PCM)
    const int16Array = new Int16Array(combined.length);
    for (let i = 0; i < combined.length; i++) {
      const s = Math.max(-1, Math.min(1, combined[i]));
      int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    
    // Convert to base64
    const arrayBuffer = int16Array.buffer;
    const base64 = this.arrayBufferToBase64(arrayBuffer);
    
    // Send to server
    this.send({
      type: 'audio-chunk',
      meetingId: this.meetingId,
      userId: this.userId,
      audioData: base64
    });
  }

  arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  createPeerConnection(initiator, targetUserId) {
    this.peer = new SimplePeer({
      initiator,
      stream: this.localStream,
      trickle: true,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      }
    });
    
    this.peer.on('signal', (signal) => {
      const messageType = signal.type === 'offer' ? 'offer' : 
                         signal.type === 'answer' ? 'answer' : 'ice-candidate';
      
      this.send({
        type: messageType,
        meetingId: this.meetingId,
        targetUserId,
        signal
      });
    });
    
    this.peer.on('stream', (stream) => {
      console.log('Received remote stream');
      this.remoteStream = stream;
      if (this.onRemoteStream) {
        this.onRemoteStream(stream);
      }
    });
    
    this.peer.on('error', (err) => {
      console.error('Peer error:', err);
    });
    
    this.peer.on('close', () => {
      console.log('Peer connection closed');
    });
  }

  handleOffer(data) {
    if (!this.peer) {
      this.createPeerConnection(false, data.fromUserId);
    }
    this.peer.signal(data.signal);
  }

  handleAnswer(data) {
    if (this.peer) {
      this.peer.signal(data.signal);
    }
  }

  handleIceCandidate(data) {
    if (this.peer) {
      this.peer.signal(data.signal);
    }
  }

  initiateCall(targetUserId) {
    this.createPeerConnection(true, targetUserId);
  }

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  leaveMeeting() {
    this.send({
      type: 'leave-meeting',
      meetingId: this.meetingId
    });
    
    this.cleanup();
  }

  cleanup() {
    this.isRecording = false;
    
    if (this.audioProcessor) {
      this.audioProcessor.disconnect();
      this.audioProcessor = null;
    }
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
    
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

export default new MeetingService();
