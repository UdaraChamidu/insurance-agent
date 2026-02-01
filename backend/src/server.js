import express from 'express';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import OpenAI from 'openai';
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
  connections.set(connectionId, ws);

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
      ws.send(JSON.stringify({ type: 'error', message: error.message }));
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
  
  const targetParticipant = meeting.participants.find(p => p.userId === targetUserId);
  if (targetParticipant) {
    targetParticipant.ws.send(JSON.stringify({
      ...signalData,
      fromUserId: connections.get(connectionId)?.userId
    }));
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
    
    // Process every 3 seconds of audio (adjust based on needs)
    // At 16kHz mono, 3 seconds ≈ 96KB
    if (meeting.audioBuffer.length >= 96000 && !meeting.isTranscribing) {
      meeting.isTranscribing = true;
      const audioToProcess = meeting.audioBuffer;
      meeting.audioBuffer = Buffer.alloc(0);
      
      // Transcribe in background
      processAudioForTranscription(meetingId, audioToProcess, userId);
    }
  } catch (error) {
    console.error('Error handling audio chunk:', error);
  }
}

async function processAudioForTranscription(meetingId, audioBuffer, userId) {
  const meeting = meetings.get(meetingId);
  if (!meeting) return;
  
  try {
    // Create a temporary file-like object for OpenAI
    const audioFile = new File([audioBuffer], 'audio.webm', { type: 'audio/webm' });
    
    // Transcribe using Whisper
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      language: 'en',
      response_format: 'json'
    });
    
    const transcribedText = transcription.text;
    
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
          content: `You are an AI assistant helping an insurance agent during a client consultation. 
          Provide brief, actionable suggestions to help the agent respond effectively to the client.
          Keep responses concise (2-3 sentences max).
          Focus on: product recommendations, addressing concerns, compliance reminders, and next steps.`
        },
        {
          role: 'user',
          content: `Recent conversation:\n${conversationContext}\n\nClient just said: "${userMessage}"\n\nWhat should the agent say or do?`
        }
      ],
      max_tokens: 150,
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
    
    // Get appointment details
    const appointment = await bookingsService.getAppointmentById(id);
    
    // Generate meeting URL if not provided
    const finalMeetingUrl = meetingUrl || `${process.env.FRONTEND_URL || 'http://localhost:3000'}/meeting?meetingId=${uuidv4()}`;
    
    // Send invitation
    const result = await bookingsService.sendInvitation(id, finalMeetingUrl);
    
    // In a real implementation, send email here
    // For now, we'll just return success
    res.json({
      success: true,
      message: `Invitation sent to ${appointment.customerEmailAddress}`,
      appointment: appointment,
      meetingUrl: finalMeetingUrl,
      emailPreview: {
        to: appointment.customerEmailAddress,
        subject: `Your Insurance Consultation is Scheduled - ${new Date(appointment.startDateTime).toLocaleDateString()}`,
        body: `Hello ${appointment.customerName},\n\nYour ${appointment.serviceName} meeting is scheduled to start in 15 minutes.\n\nMeeting Details:\n- Date: ${new Date(appointment.startDateTime).toLocaleDateString()}\n- Time: ${new Date(appointment.startDateTime).toLocaleTimeString()}\n- Duration: ${Math.round((new Date(appointment.endDateTime) - new Date(appointment.startDateTime)) / 60000)} minutes\n\nJoin Meeting: ${finalMeetingUrl}\n\nPlease join a few minutes early to test your audio and video.\n\nBest regards,\nSecureLife Insurance Team`
      }
    });
  } catch (error) {
    console.error('Error sending invitation:', error);
    res.status(500).json({ error: 'Failed to send invitation', message: error.message });
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
