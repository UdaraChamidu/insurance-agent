// Native WebRTC Meeting Service (no SimplePeer dependency)
const AUDIO_CAPTURE_WORKLET_URL = new URL('../worklets/audioCaptureWorklet.js', import.meta.url);

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
    this.audioSourceNode = null;
    this.audioWorkletNode = null;
    this.isRecording = false;
    this.audioSampleRate = 16000;
    this.audioInputBufferSize = 2048;
    this.audioSendIntervalMs = 180;
    this.audioCaptureMode = 'script-processor';
    this.audioWorkletModuleLoaded = false;
    this.audioAlwaysStream = true;
    this.audioVADConfig = {
      rmsThreshold: 0.006,
      speechStartMs: 60,
      speechEndMs: 420,
      preRollMs: 140,
      silenceHeartbeatMs: 2500
    };
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
        if (data.userId && data.userId === this.targetUserId) {
          this.targetUserId = null;
          if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
          }
        }
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
      // Ensure stale tracks from a prior session do not interfere
      if (this.localStream) {
        this.localStream.getTracks().forEach(track => track.stop());
        this.localStream = null;
      }

      // Get user media
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1
          // Removed sampleRate: 16000 to fix OverconstrainedError on mobiles
          // browser will handle resampling in AudioContext
        }
      });

      const videoTrack = this.localStream.getVideoTracks()[0];
      if (!videoTrack || videoTrack.readyState !== 'live') {
        throw new Error('Camera video track is unavailable.');
      }
      
      console.log('✅ Got local media stream');
      
      // Start audio processing for transcription
      await this.startAudioProcessing();
      
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

  async restartCameraTrack() {
    try {
      const freshStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });

      const newVideoTrack = freshStream.getVideoTracks()[0];
      if (!newVideoTrack) {
        throw new Error('No new camera track available.');
      }

      if (!this.localStream) {
        this.localStream = new MediaStream();
      }

      this.localStream.getVideoTracks().forEach(track => {
        this.localStream.removeTrack(track);
        track.stop();
      });
      this.localStream.addTrack(newVideoTrack);

      if (this.peerConnection) {
        const sender = this.peerConnection.getSenders().find(
          s => s.track && s.track.kind === 'video'
        );
        if (sender) {
          await sender.replaceTrack(newVideoTrack);
        }
      }

      return this.localStream;
    } catch (error) {
      console.error('❌ Error restarting camera track:', error);
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
      const fromUserId = data.fromUserId || data.from;
      console.log('📥 Received offer from:', fromUserId);
      
      this.targetUserId = fromUserId;
      this.createPeerConnection();
      
      await this.peerConnection.setRemoteDescription(
        new RTCSessionDescription(data.signal || data.offer)
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
      console.log('📥 Received answer from:', data.fromUserId || data.from);
      
      await this.peerConnection.setRemoteDescription(
        new RTCSessionDescription(data.signal || data.answer)
      );
    } catch (error) {
      console.error('❌ Error handling answer:', error);
    }
  }

  async handleIceCandidate(data) {
    try {
      const candidate = data.signal?.candidate || data.candidate;
      if (candidate) {
        console.log('🧊 Adding ICE candidate');
        await this.peerConnection.addIceCandidate(
          new RTCIceCandidate(candidate)
        );
      }
    } catch (error) {
      console.error('❌ Error handling ICE candidate:', error);
    }
  }

  async startAudioProcessing() {
    // Reset any previous graph before creating a new one.
    if (this.audioWorkletNode) {
      this.audioWorkletNode.port.onmessage = null;
      this.audioWorkletNode.disconnect();
      this.audioWorkletNode = null;
    }
    if (this.audioProcessor) {
      this.audioProcessor.disconnect();
      this.audioProcessor.onaudioprocess = null;
      this.audioProcessor = null;
    }
    if (this.audioSourceNode) {
      this.audioSourceNode.disconnect();
      this.audioSourceNode = null;
    }
    if (this.audioContext) {
      await this.audioContext.close();
      this.audioContext = null;
    }

    try {
      // Try to use 16kHz context for backend compatibility
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 16000
      });
    } catch (e) {
      console.warn('Could not force 16kHz sample rate, falling back to default:', e);
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    this.audioSourceNode = this.audioContext.createMediaStreamSource(this.localStream);
    this.audioSampleRate = this.audioContext.sampleRate || 16000;
    this.audioCaptureMode = 'script-processor';

    let pendingChunks = [];
    let pendingLength = 0;
    let lastFlushAt = performance.now();

    const flushAudio = (force = false) => {
      if (pendingLength === 0) return;

      const elapsedMs = performance.now() - lastFlushAt;
      const minSamples = Math.floor(this.audioSampleRate * 0.2);
      if (!force && elapsedMs < this.audioSendIntervalMs && pendingLength < minSamples) {
        return;
      }

      this.sendAudioChunk(pendingChunks, this.audioSampleRate);
      pendingChunks = [];
      pendingLength = 0;
      lastFlushAt = performance.now();
    };

    const handleAudioFrame = (frame) => {
      if (!this.isRecording || !frame) return;
      const audioData = frame instanceof Float32Array ? frame : new Float32Array(frame);
      pendingChunks.push(audioData);
      pendingLength += audioData.length;
      flushAudio(false);
    };

    const setupScriptProcessor = () => {
      this.audioCaptureMode = 'script-processor';
      const rmsThreshold = this.audioVADConfig.rmsThreshold;
      const speechStartMs = this.audioVADConfig.speechStartMs;
      const speechEndMs = this.audioVADConfig.speechEndMs;
      const preRollMs = this.audioVADConfig.preRollMs;
      const preRollFrameLimit = Math.max(
        2,
        Math.ceil((preRollMs / 1000) * this.audioSampleRate / this.audioInputBufferSize)
      );
      const preRollFrames = [];
      let speechActive = false;
      let speechCandidateStartAt = 0;
      let lastSpeechAt = 0;

      const calcRms = (frame) => {
        if (!frame || frame.length === 0) return 0;
        let sumSquares = 0;
        for (let i = 0; i < frame.length; i++) {
          const value = frame[i];
          sumSquares += value * value;
        }
        return Math.sqrt(sumSquares / frame.length);
      };

      this.audioProcessor = this.audioContext.createScriptProcessor(this.audioInputBufferSize, 1, 1);
      this.audioProcessor.onaudioprocess = (e) => {
        if (!this.isRecording) return;

        const inputData = e.inputBuffer.getChannelData(0);
        const frame = new Float32Array(inputData);
        const now = performance.now();
        const rms = calcRms(frame);
        const hasVoice = rms >= rmsThreshold;

        if (this.audioAlwaysStream) {
          handleAudioFrame(frame);
          return;
        }

        preRollFrames.push(frame);
        if (preRollFrames.length > preRollFrameLimit) {
          preRollFrames.shift();
        }

        if (hasVoice) {
          let emittedCurrentViaPreRoll = false;
          if (!speechActive) {
            if (!speechCandidateStartAt) {
              speechCandidateStartAt = now;
            }
            if ((now - speechCandidateStartAt) >= speechStartMs) {
              speechActive = true;
              lastSpeechAt = now;
              // Include buffered lead-in audio so first syllables are not clipped.
              preRollFrames.forEach((bufferedFrame) => handleAudioFrame(bufferedFrame));
              emittedCurrentViaPreRoll = true;
              preRollFrames.length = 0;
            }
          } else {
            lastSpeechAt = now;
          }

          if (speechActive && !emittedCurrentViaPreRoll) {
            handleAudioFrame(frame);
          }
          return;
        }

        // Reset start candidate while below threshold.
        speechCandidateStartAt = 0;

        if (!speechActive) {
          return;
        }

        // Keep brief tail silence for more natural sentence endings.
        handleAudioFrame(frame);
        if ((now - lastSpeechAt) >= speechEndMs) {
          speechActive = false;
          flushAudio(true);
        }
      };
      this.audioSourceNode.connect(this.audioProcessor);
      this.audioProcessor.connect(this.audioContext.destination);
    };

    let workletReady = false;
    if (this.audioContext.audioWorklet && typeof AudioWorkletNode !== 'undefined') {
      try {
        if (!this.audioWorkletModuleLoaded) {
          await this.audioContext.audioWorklet.addModule(AUDIO_CAPTURE_WORKLET_URL);
          this.audioWorkletModuleLoaded = true;
        }

        this.audioWorkletNode = new AudioWorkletNode(this.audioContext, 'audio-capture-processor', {
          numberOfInputs: 1,
          numberOfOutputs: 1,
          outputChannelCount: [1],
          channelCount: 1,
          channelCountMode: 'explicit',
          processorOptions: {
            alwaysStream: this.audioAlwaysStream,
            rmsThreshold: this.audioVADConfig.rmsThreshold,
            speechStartMs: this.audioVADConfig.speechStartMs,
            speechEndMs: this.audioVADConfig.speechEndMs,
            preRollMs: this.audioVADConfig.preRollMs,
            silenceHeartbeatMs: this.audioVADConfig.silenceHeartbeatMs
          }
        });

        this.audioWorkletNode.port.onmessage = (event) => {
          const payload = event.data;
          if (!payload) return;

          if (payload.type === 'audio-frame') {
            handleAudioFrame(payload.frame);
            return;
          }

          if (payload.type === 'vad-state') {
            if (payload.flush) {
              flushAudio(true);
            }
            return;
          }

          if (payload.type === 'silence-heartbeat') {
            // Keepalive marker from worklet; no audio sent during silence.
            return;
          }

          // Backward compatibility if a raw frame is ever posted directly.
          handleAudioFrame(payload);
        };

        this.audioSourceNode.connect(this.audioWorkletNode);
        this.audioWorkletNode.connect(this.audioContext.destination);
        this.audioCaptureMode = 'audio-worklet';
        workletReady = true;
      } catch (error) {
        console.warn('AudioWorklet capture unavailable, falling back to ScriptProcessor.', error);
        if (this.audioWorkletNode) {
          this.audioWorkletNode.port.onmessage = null;
          this.audioWorkletNode.disconnect();
          this.audioWorkletNode = null;
        }
      }
    }

    if (!workletReady) {
      setupScriptProcessor();
    }

    this.isRecording = true;
    console.log(`Audio processing started at ${this.audioSampleRate}Hz using ${this.audioCaptureMode}`);
  }

  sendAudioChunk(audioChunks, sampleRate = 16000) {
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
      clientSentAtMs: Date.now(),
      sampleRate,
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

  requestAISuggestion(meetingId, text, userId, metadata = {}) {
    this.send({
      type: 'request-ai-suggestion',
      meetingId,
      text,
      userId,
      metadata
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

    if (this.audioWorkletNode) {
      this.audioWorkletNode.port.onmessage = null;
      this.audioWorkletNode.disconnect();
      this.audioWorkletNode = null;
    }
    
    if (this.audioProcessor) {
      this.audioProcessor.disconnect();
      this.audioProcessor.onaudioprocess = null;
      this.audioProcessor = null;
    }

    if (this.audioSourceNode) {
      this.audioSourceNode.disconnect();
      this.audioSourceNode = null;
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

