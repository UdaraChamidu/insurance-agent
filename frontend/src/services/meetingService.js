// Native WebRTC Meeting Service (no SimplePeer dependency)

class MeetingService {
  constructor() {
    this.ws = null;
    this.peerConnection = null;
    this.localStream = null;
    this.remoteStream = null;
    this.meetingId = null;
    this.userId = null;
    this.role = null;
    this.audioContext = null;
    this.audioProcessor = null;
    this.isRecording = false;
    this.targetUserId = null;
    this.makingOffer = false;
    this.ignoreOffer = false;
    
    // Callbacks
    this.onTranscription = null;
    this.onAISuggestion = null;
    this.onParticipantJoined = null;
    this.onParticipantLeft = null;
    this.onRemoteStream = null;
    
    // ICE servers
    this.iceServers = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' }
    ];
  }

  connect(wsUrl) {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(wsUrl);
      
      this.ws.onopen = () => {
        console.log('✅ WebSocket connected');
        resolve();
      };
      
      this.ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        reject(error);
      };
      
      this.ws.onmessage = (event) => {
        this.handleMessage(JSON.parse(event.data));
      };
      
      this.ws.onclose = () => {
        console.log('🔌 WebSocket disconnected');
        this.cleanup();
      };
    });
  }

  handleMessage(data) {
    switch (data.type) {
      case 'joined-meeting':
        console.log('✅ Joined meeting:', data);
        
        // If there are existing participants, WE are the newcomer - we should initiate
        if (data.participants && data.participants.length > 1) {
          const otherParticipants = data.participants.filter(p => p.userId !== this.userId);
          console.log(`🔗 Found ${otherParticipants.length} existing participant(s)`);
          
          if (otherParticipants.length > 0) {
            this.targetUserId = otherParticipants[0].userId;
            console.log('📞 I am newcomer, will initiate call to:', this.targetUserId);
            // Create connection and make offer
            setTimeout(() => this.createOffer(), 1000);
          }
        }
        break;
      
      case 'participant-joined':
        console.log('👤 Participant joined:', data);
        if (this.onParticipantJoined) {
          this.onParticipantJoined(data);
        }
        
        // DON'T initiate here - let the newcomer initiate
        // We just wait for their offer
        if (!this.targetUserId && data.userId !== this.userId) {
          this.targetUserId = data.userId;
          console.log('👋 New participant will call me, waiting for offer from:', data.userId);
        }
        break;
      
      case 'participant-left':
        console.log('👋 Participant left:', data);
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
        console.log('📝 Transcription received:', data);
        if (this.onTranscription) {
          this.onTranscription(data);
        }
        break;
      
      case 'ai-suggestion':
        console.log('💡 AI suggestion received:', data);
        if (this.onAISuggestion) {
          this.onAISuggestion(data);
        }
        break;
      
      case 'error':
        console.error('❌ Server error:', data.message);
        break;
    }
  }

  async joinMeeting(meetingId, userId, role) {
    this.meetingId = meetingId;
    this.userId = userId;
    this.role = role;
    
    try {
      // Get user media
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: {
          echoCancellation: true,
          noiseSuppression: true
          // Removed sampleRate: 16000 to fix OverconstrainedError on mobiles
          // browser will handle resampling in AudioContext
        }
      });
      
      console.log('✅ Got local media stream');
      
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
      console.error('❌ Error getting user media:', error);
      throw error;
    }
  }

  createPeerConnection() {
    if (this.peerConnection) {
      console.log('🔄 Closing existing peer connection');
      this.peerConnection.close();
    }

    console.log('🔗 Creating new RTCPeerConnection');
    
    this.peerConnection = new RTCPeerConnection({
      iceServers: this.iceServers
    });

    // Add local stream tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        console.log('➕ Adding track to peer connection:', track.kind);
        this.peerConnection.addTrack(track, this.localStream);
      });
    }

    // Handle incoming tracks
    this.peerConnection.ontrack = (event) => {
      console.log('📹 Received remote track:', event.track.kind);
      
      // Use the stream from the event directly
      this.remoteStream = event.streams[0];
      
      console.log('📹 Setting remote stream');
      if (this.onRemoteStream) {
        this.onRemoteStream(this.remoteStream);
      }
    };

    // Handle ICE candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('🧊 Sending ICE candidate');
        this.send({
          type: 'ice-candidate',
          meetingId: this.meetingId,
          targetUserId: this.targetUserId,
          signal: { candidate: event.candidate }
        });
      }
    };

    // Handle connection state
    this.peerConnection.onconnectionstatechange = () => {
      console.log('🔗 Connection state:', this.peerConnection.connectionState);
      if (this.peerConnection.connectionState === 'connected') {
        console.log('✅ Peer connected successfully!');
      }
    };

    // Handle ICE connection state
    this.peerConnection.oniceconnectionstatechange = () => {
      console.log('🧊 ICE connection state:', this.peerConnection.iceConnectionState);
    };

    return this.peerConnection;
  }

  async createOffer() {
    try {
      console.log('📤 Creating offer...');
      
      this.createPeerConnection();
      
      const offer = await this.peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });
      
      await this.peerConnection.setLocalDescription(offer);
      
      console.log('📤 Sending offer');
      this.send({
        type: 'offer',
        meetingId: this.meetingId,
        targetUserId: this.targetUserId,
        signal: { 
          type: 'offer',
          sdp: offer.sdp 
        }
      });
    } catch (error) {
      console.error('❌ Error creating offer:', error);
    }
  }

  async handleOffer(data) {
    try {
      console.log('📥 Received offer from:', data.fromUserId);
      
      this.targetUserId = data.fromUserId;
      this.createPeerConnection();
      
      await this.peerConnection.setRemoteDescription(
        new RTCSessionDescription(data.signal)
      );
      
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);
      
      console.log('📤 Sending answer');
      this.send({
        type: 'answer',
        meetingId: this.meetingId,
        targetUserId: this.targetUserId,
        signal: {
          type: 'answer',
          sdp: answer.sdp
        }
      });
    } catch (error) {
      console.error('❌ Error handling offer:', error);
    }
  }

  async handleAnswer(data) {
    try {
      console.log('📥 Received answer from:', data.fromUserId);
      
      await this.peerConnection.setRemoteDescription(
        new RTCSessionDescription(data.signal)
      );
    } catch (error) {
      console.error('❌ Error handling answer:', error);
    }
  }

  async handleIceCandidate(data) {
    try {
      if (data.signal && data.signal.candidate) {
        console.log('🧊 Adding ICE candidate');
        await this.peerConnection.addIceCandidate(
          new RTCIceCandidate(data.signal.candidate)
        );
      }
    } catch (error) {
      console.error('❌ Error handling ICE candidate:', error);
    }
  }

  startAudioProcessing() {
    try {
      // Try to use 16kHz context for backend compatibility
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 16000 
      });
    } catch (e) {
      console.warn('⚠️ Could not force 16kHz sample rate, falling back to default:', e);
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    const source = this.audioContext.createMediaStreamSource(this.localStream);
    
    // Use 4096 buffer size. 
    // If sampleRate is 48000, 4096 is ~0.08s. If 16000, it's ~0.25s.
    this.audioProcessor = this.audioContext.createScriptProcessor(4096, 1, 1);
    
    let audioChunksBuffer = []; // renamed to avoid shadowing
    let chunkCount = 0;
    
    const contextRate = this.audioContext.sampleRate;
    const CHUNKS_PER_SECOND = Math.floor(contextRate / 4096);
    // Send roughly every 4 seconds
    const SEND_INTERVAL = CHUNKS_PER_SECOND * 4; 
    
    console.log(`🎤 Audio processing started at ${contextRate}Hz`);
    
    // If rate is NOT 16000, we theoretically should resample. 
    // For now, we'll warn if mismatch, as simple linear resampling in JS is heavy.
    if (contextRate !== 16000) {
        console.warn("⚠️ Audio sampling rate mismatch. Backend expects 16000Hz. Audio may sound distorted.");
        // TODO: Implement downsampling worker if needed
    }

    this.audioProcessor.onaudioprocess = (e) => {
      if (!this.isRecording) return;
      
      const inputData = e.inputBuffer.getChannelData(0);
      const audioData = new Float32Array(inputData);
      audioChunksBuffer.push(audioData);
      chunkCount++;
      
      if (chunkCount >= SEND_INTERVAL) {
        console.log(`🎵 Sending ${audioChunksBuffer.length} audio chunks`);
        this.sendAudioChunk(audioChunksBuffer);
        audioChunksBuffer = [];
        chunkCount = 0;
      }
    };
    
    source.connect(this.audioProcessor);
    this.audioProcessor.connect(this.audioContext.destination);
    this.isRecording = true;
  }

  sendAudioChunk(audioChunks) {
    const totalLength = audioChunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const combined = new Float32Array(totalLength);
    let offset = 0;
    
    for (const chunk of audioChunks) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }
    
    const int16Array = new Int16Array(combined.length);
    for (let i = 0; i < combined.length; i++) {
      const s = Math.max(-1, Math.min(1, combined[i]));
      int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    
    const arrayBuffer = int16Array.buffer;
    const base64 = this.arrayBufferToBase64(arrayBuffer);
    
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

  requestAISuggestion(meetingId, text, userId) {
    this.send({
      type: 'request-ai-suggestion',
      meetingId,
      text,
      userId
    });
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

  async startScreenShare() {
    try {
      console.log('🖥️ Starting screen share...');
      // Get screen stream
      this.screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const screenTrack = this.screenStream.getVideoTracks()[0];
      
      // Replace video track in peer connection
      if (this.peerConnection) {
        const sender = this.peerConnection.getSenders().find(s => s.track && s.track.kind === 'video');
        if (sender) {
          console.log('🔄 Replacing camera track with screen track');
          await sender.replaceTrack(screenTrack);
        }
      }
      
      // Handle browser's "Stop Sharing" button
      screenTrack.onended = () => {
        console.log('🛑 Screen sharing ended via browser UI');
        this.stopScreenShare();
      };
      
      return this.screenStream;
    } catch (error) {
      console.error('❌ Error getting screen media:', error);
      throw error;
    }
  }

  async stopScreenShare() {
    console.log('🛑 Stopping screen share...');
    
    // Stop screen tracks
    if (this.screenStream) {
      this.screenStream.getTracks().forEach(track => track.stop());
      this.screenStream = null;
    }
    
    // Switch back to camera track
    if (this.localStream && this.peerConnection) {
      const cameraTrack = this.localStream.getVideoTracks()[0];
      const sender = this.peerConnection.getSenders().find(s => s.track && s.track.kind === 'video');
      if (sender && cameraTrack) {
        console.log('🔄 Reverting to camera track');
        await sender.replaceTrack(cameraTrack);
      }
    }
    
    return this.localStream;
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
    
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

export default new MeetingService();
