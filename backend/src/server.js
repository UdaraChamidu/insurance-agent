import express from 'express';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import OpenAI, { toFile } from 'openai';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

import { smartBookingsService as bookingsService } from './services/bookings-service.js';
import { autoIngestionService } from './services/auto-ingestion-service.js';

app.use(cors());
app.use(express.json());

// Store active meetings
const meetings = new Map();
const connections = new Map();

// WebSocket connection handler
wss.on('connection', (ws) => {
  const connectionId = uuidv4();
  connections.set(connectionId, { ws, userId: null }); // Store object with ws and userId

  console.log(`New connection: ${connectionId}`);

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      
      switch (data.type) {
        case 'join-meeting':
          await handleJoinMeeting(ws, data, connectionId);
          break;
        
        case 'offer':
        case 'answer':
        case 'ice-candidate':
          await handleWebRTCSignaling(data, connectionId);
          break;
        
        case 'audio-chunk':
          await handleAudioChunk(data, connectionId);
          break;
        
        case 'leave-meeting':
          handleLeaveMeeting(data, connectionId);
          break;
      }
    } catch (error) {
      console.error('Error handling message:', error);
      const connection = connections.get(connectionId);
      if (connection && connection.ws) {
        connection.ws.send(JSON.stringify({ type: 'error', message: error.message }));
      }
    }
  });

  ws.on('close', () => {
    console.log(`Connection closed: ${connectionId}`);
    connections.delete(connectionId);
    // Clean up any meetings this user was in
    for (const [meetingId, meeting] of meetings.entries()) {
      meeting.participants = meeting.participants.filter(p => p.connectionId !== connectionId);
      if (meeting.participants.length === 0) {
        meetings.delete(meetingId);
      }
    }
  });
});

async function handleJoinMeeting(ws, data, connectionId) {
  const { meetingId, userId, role } = data;
  
  // Store userId in connection for later signaling
  const connection = connections.get(connectionId);
  if (connection) {
    connection.userId = userId;
  }
  
  if (!meetings.has(meetingId)) {
    meetings.set(meetingId, {
      id: meetingId,
      participants: [],
      transcriptions: [],
      audioBuffer: Buffer.alloc(0),
      isTranscribing: false
    });
  }
  
  const meeting = meetings.get(meetingId);
  meeting.participants.push({
    connectionId,
    userId,
    role,
    ws
  });
  
  console.log(`✅ ${userId} joined meeting ${meetingId} as ${role}`);
  console.log(`   Total participants: ${meeting.participants.length}`);
  
  // Notify all participants
  broadcastToMeeting(meetingId, {
    type: 'participant-joined',
    userId,
    role,
    participants: meeting.participants.map(p => ({ userId: p.userId, role: p.role }))
  });
  
  ws.send(JSON.stringify({
    type: 'joined-meeting',
    meetingId,
    participants: meeting.participants.map(p => ({ userId: p.userId, role: p.role }))
  }));
}

async function handleWebRTCSignaling(data, connectionId) {
  const { meetingId, targetUserId, ...signalData } = data;
  const meeting = meetings.get(meetingId);
  
  if (!meeting) return;
  
  // Get sender's userId from connections
  const senderConnection = connections.get(connectionId);
  const fromUserId = senderConnection ? senderConnection.userId : null;
  
  console.log(`📡 Relaying ${data.type} from ${fromUserId} to ${targetUserId}`);
  
  const targetParticipant = meeting.participants.find(p => p.userId === targetUserId);
  if (targetParticipant) {
    targetParticipant.ws.send(JSON.stringify({
      ...signalData,
      fromUserId: fromUserId  // Properly attach sender's userId
    }));
  } else {
    console.log(`⚠️  Target participant ${targetUserId} not found`);
  }
}

async function handleAudioChunk(data, connectionId) {
  const { meetingId, audioData, userId } = data;
  const meeting = meetings.get(meetingId);
  
  if (!meeting) return;
  
  try {
    // Convert base64 audio to buffer
    const audioBuffer = Buffer.from(audioData, 'base64');
    
    // Append to meeting's audio buffer
    meeting.audioBuffer = Buffer.concat([meeting.audioBuffer, audioBuffer]);
    
    // Privacy/Cost Check: Only process audio if there are at least 2 participants (Agent + Client)
    if (meeting.participants.length < 2) {
      // Clear buffer to prevent memory leak, but DO NOT process
      if (meeting.audioBuffer.length > 500000) { // Clear if gets too big
         meeting.audioBuffer = Buffer.alloc(0);
      }
      return;
    }
    
    console.log(`🎤 Audio buffer: ${meeting.audioBuffer.length} bytes`);
    
    // Process every 8 seconds of audio (at 16kHz mono, 8 seconds ≈ 256KB)
    if (meeting.audioBuffer.length >= 256000 && !meeting.isTranscribing) {
      meeting.isTranscribing = true;
      const audioToProcess = meeting.audioBuffer;
      meeting.audioBuffer = Buffer.alloc(0);
      
      console.log(`📤 Processing ${audioToProcess.length} bytes of audio`);
      
      // Transcribe in background
      processAudioForTranscription(meetingId, audioToProcess, userId);
    }
  } catch (error) {
    console.error('Error handling audio chunk:', error);
  }
}

// Helper function to convert PCM to WAV format
function convertPCMtoWAV(pcmBuffer) {
  const sampleRate = 16000;
  const numChannels = 1;
  const bitsPerSample = 16;
  
  const dataSize = pcmBuffer.length;
  const headerSize = 44;
  const fileSize = headerSize + dataSize;
  
  const wavBuffer = Buffer.alloc(fileSize);
  
  // WAV header
  wavBuffer.write('RIFF', 0);
  wavBuffer.writeUInt32LE(fileSize - 8, 4);
  wavBuffer.write('WAVE', 8);
  wavBuffer.write('fmt ', 12);
  wavBuffer.writeUInt32LE(16, 16); // fmt chunk size
  wavBuffer.writeUInt16LE(1, 20); // PCM format
  wavBuffer.writeUInt16LE(numChannels, 22);
  wavBuffer.writeUInt32LE(sampleRate, 24);
  wavBuffer.writeUInt32LE(sampleRate * numChannels * bitsPerSample / 8, 28); // byte rate
  wavBuffer.writeUInt16LE(numChannels * bitsPerSample / 8, 32); // block align
  wavBuffer.writeUInt16LE(bitsPerSample, 34);
  wavBuffer.write('data', 36);
  wavBuffer.writeUInt32LE(dataSize, 40);
  
  // Copy PCM data
  pcmBuffer.copy(wavBuffer, headerSize);
  
  return wavBuffer;
}

async function processAudioForTranscription(meetingId, audioBuffer, userId) {
  const meeting = meetings.get(meetingId);
  if (!meeting) return;
  
  try {
    console.log(`🎤 Transcribing audio from ${userId} (${audioBuffer.length} bytes)`);
    
    // Convert PCM to WAV format for Whisper
    const wavBuffer = convertPCMtoWAV(audioBuffer);
    
    // Transcribe using Whisper with toFile
    const transcription = await openai.audio.transcriptions.create({
      file: await toFile(wavBuffer, 'audio.wav'),
      model: 'whisper-1',
      language: 'en'
    });
    
    const transcribedText = transcription.text;
    
    console.log(`📝 Transcription: "${transcribedText}"`);
    
    if (transcribedText.trim()) {
      // Store transcription
      const transcriptionEntry = {
        userId,
        text: transcribedText,
        timestamp: new Date().toISOString()
      };
      
      meeting.transcriptions.push(transcriptionEntry);
      
      // Send transcription to admin
      broadcastToAdmins(meetingId, {
        type: 'transcription',
        ...transcriptionEntry
      });
      
      // Generate AI response for admin
      await generateAIResponse(meetingId, transcribedText, userId);
    }
  } catch (error) {
    console.error('Error transcribing audio:', error);
  } finally {
    meeting.isTranscribing = false;
  }
}

async function generateAIResponse(meetingId, userMessage, userId) {
  const meeting = meetings.get(meetingId);
  if (!meeting) return;
  
  try {
    // Build conversation context
    const recentTranscriptions = meeting.transcriptions.slice(-10);
    const conversationContext = recentTranscriptions
      .map(t => `${t.userId}: ${t.text}`)
      .join('\n');
    
    // Generate AI suggestion
    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: `You are an AI assistant for insurance agents during live calls. Generate SHORT, ACTIONABLE suggestions.

FORMAT: Use bullet points (• or -)
LENGTH: 1-2 bullets max, each under 15 words
TONE: Direct and professional

Focus on:
• Product recommendations
• Compliance reminders
• Quick responses
• Next steps

GOOD example:
• Recommend Term Life - matches 20-year need
• Ask about existing policies

BAD example (too wordy):
"You could respond with: 'It's great to hear about...'"

Be concise!`
        },
        {
          role: 'user',
          content: `Recent conversation:\n${conversationContext}\n\nClient just said: "${userMessage}"\n\nWhat should the agent say or do?`
        }
      ],
      max_tokens: 100,
      temperature: 0.7
    });
    
    const aiSuggestion = completion.choices[0].message.content;
    
    // Send AI suggestion to admins only
    broadcastToAdmins(meetingId, {
      type: 'ai-suggestion',
      suggestion: aiSuggestion,
      relatedTo: userMessage,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error generating AI response:', error);
  }
}

function broadcastToMeeting(meetingId, message) {
  const meeting = meetings.get(meetingId);
  if (!meeting) return;
  
  meeting.participants.forEach(participant => {
    if (participant.ws.readyState === 1) { // WebSocket.OPEN
      participant.ws.send(JSON.stringify(message));
    }
  });
}

function broadcastToAdmins(meetingId, message) {
  const meeting = meetings.get(meetingId);
  if (!meeting) return;
  
  meeting.participants
    .filter(p => p.role === 'admin')
    .forEach(admin => {
      if (admin.ws.readyState === 1) {
        admin.ws.send(JSON.stringify(message));
      }
    });
}

function handleLeaveMeeting(data, connectionId) {
  const { meetingId } = data;
  const meeting = meetings.get(meetingId);
  
  if (!meeting) return;
  
  const participantIndex = meeting.participants.findIndex(p => p.connectionId === connectionId);
  if (participantIndex !== -1) {
    const participant = meeting.participants[participantIndex];
    meeting.participants.splice(participantIndex, 1);
    
    broadcastToMeeting(meetingId, {
      type: 'participant-left',
      userId: participant.userId
    });
    
    if (meeting.participants.length === 0) {
      meetings.delete(meetingId);
    }
  }
}

// REST API endpoints
app.post('/api/meetings', (req, res) => {
  const meetingId = uuidv4();
  res.json({ meetingId });
});

app.get('/api/meetings/:meetingId', (req, res) => {
  const meeting = meetings.get(req.params.meetingId);
  if (!meeting) {
    return res.status(404).json({ error: 'Meeting not found' });
  }
  
  res.json({
    id: meeting.id,
    participants: meeting.participants.length,
    transcriptions: meeting.transcriptions
  });
});

// Get all appointments with optional filters
app.get('/api/bookings/appointments', async (req, res) => {
  try {
    const { startDate, endDate, status } = req.query;
    const appointments = await bookingsService.getAppointments(startDate, endDate, status);
    res.json({ appointments, count: appointments.length });
  } catch (error) {
    console.error('Error fetching appointments:', error);
    res.status(500).json({ error: 'Failed to fetch appointments', message: error.message });
  }
});

// Get specific appointment by ID
app.get('/api/bookings/appointments/:id', async (req, res) => {
  try {
    const appointment = await bookingsService.getAppointmentById(req.params.id);
    res.json(appointment);
  } catch (error) {
    console.error('Error fetching appointment:', error);
    res.status(404).json({ error: 'Appointment not found', message: error.message });
  }
});

// Get booking business info
app.get('/api/bookings/business', async (req, res) => {
  try {
    const business = await bookingsService.getBookingBusiness();
    res.json(business);
  } catch (error) {
    console.error('Error fetching business info:', error);
    res.status(500).json({ error: 'Failed to fetch business info', message: error.message });
  }
});

// Send invitation for an appointment
app.post('/api/bookings/appointments/:id/send-invitation', async (req, res) => {
  try {
    const { id } = req.params;
    const { meetingUrl } = req.body;
    
    console.log(`📧 Sending invitation for appointment ${id}...`);
    
    // Get appointment details
    const appointment = await bookingsService.getAppointmentById(id);
    
    // Generate meeting URL if not provided
    const baseUrl = process.env.MEETING_BASE_URL || 'http://localhost:5173';
    const meetingId = uuidv4();
    const finalMeetingUrl = meetingUrl || `${baseUrl}/meeting?meetingId=${meetingId}&role=client`;
    
    console.log(`🔗 Meeting URL: ${finalMeetingUrl}`);
    
    // Send invitation
    const result = await bookingsService.sendInvitation(id, finalMeetingUrl);
    
    res.json({
      success: true,
      message: `Invitation sent to ${appointment.customerEmailAddress}`,
      appointment: appointment,
      meetingUrl: finalMeetingUrl,
      result: result
    });
  } catch (error) {
    console.error('❌ Error in send-invitation endpoint:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      details: error.stack
    });
  }
});

// Update appointment status
app.patch('/api/bookings/appointments/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }
    
    const updatedAppointment = await bookingsService.updateAppointmentStatus(id, status);
    res.json(updatedAppointment);
  } catch (error) {
    console.error('Error updating appointment:', error);
    res.status(500).json({ error: 'Failed to update appointment', message: error.message });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  
  // Start auto-ingestion service
  try {
    await autoIngestionService.start();
  } catch (error) {
    console.error('❌ Failed to start auto-ingestion:', error.message);
    console.log('⚠️  Auto-ingestion disabled. Server will continue without it.');
  }
});
