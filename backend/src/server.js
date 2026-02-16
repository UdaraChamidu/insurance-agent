import express from 'express';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

import ghlService from './services/ghl-service.js';
import leadSessionStore from './models/LeadSession.js';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

import { smartBookingsService as bookingsService } from './services/bookings-service.js';
import { autoIngestionService } from './services/auto-ingestion-service.js';
import { sendSMS } from './services/sms-service.js';
import { pineconeService } from './services/pinecone-service.js';
import { embeddingService } from './services/embedding-service.js';

app.use(cors());
app.use(express.json());

// SMS Endpoint
app.post('/api/send-sms', async (req, res) => {
  try {
    const { to, message } = req.body;
    
    if (!to || !message) {
      return res.status(400).json({ error: 'Missing "to" (phone number) or "message"' });
    }
    
    // Basic phone number cleaning - remove spaces, dashes, parentheses
    let cleanTo = to.replace(/[\s\-\(\)]/g, '');
    
    // Add + prefix if missing (assumes customer entered full country code like 94761720686)
    if (!cleanTo.startsWith('+')) {
      cleanTo = '+' + cleanTo;
    }

    const result = await sendSMS(cleanTo, message);
    res.json({ success: true, sid: result.sid });
  } catch (error) {
    console.error('API Error sending SMS:', error);
    res.status(500).json({ error: error.message });
  }
});

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
        
        case 'request-ai-suggestion':
          await handleManualAISuggestion(data, connectionId);
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
    
    // Convert PCM to WAV format for Gemini
    const wavBuffer = convertPCMtoWAV(audioBuffer);

    // Transcribe using Gemini multimodal audio
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const audioBase64 = wavBuffer.toString('base64');
    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: 'audio/wav',
          data: audioBase64
        }
      },
      { text: 'Transcribe this audio exactly. Return ONLY the spoken words, nothing else. If there is silence or no speech, return an empty string.' }
    ]);

    const transcribedText = result.response.text();
    
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
      
      // Auto-AI removed: suggestions are now manual
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
    
    // === RAG RETRIEVAL ===
    let retrievedContext = '';
    let sourceCitations = [];
    
    try {
      // Generate embedding for the user's query
      const queryEmbedding = await embeddingService.generateEmbedding(userMessage);
      
      // Query all relevant namespaces (we can refine this based on detected keywords later)
      const namespaces = [
        'training-reference',
        'fl-state-authority',
        'cms-medicare',
        'federal-aca',
        'erisa-irs-selffunded',
        'fl-medicaid-agency',
        'carrier-fmo-policies'
      ];
      
      
      // Execute queries in parallel for all namespaces
      const queryPromises = namespaces.map(async (namespace) => {
        try {
          const matches = await pineconeService.query({
            vector: queryEmbedding,
            namespace: namespace,
            topK: 3
          });
          // Attach namespace to matches
          return matches.map(m => ({ ...m, namespace }));
        } catch (nsError) {
          // Namespace might not exist yet, skip silently but log
          console.log(`ℹ️ Namespace ${namespace} query failed: ${nsError.message}`);
          return [];
        }
      });
      
      // Wait for all queries to complete
      const results = await Promise.all(queryPromises);
      
      // Flatten results into a single array
      let allMatches = results.flat();
      
      // Sort by score and take top 5
      allMatches.sort((a, b) => (b.score || 0) - (a.score || 0));
      const topMatches = allMatches.slice(0, 5);
      
      if (topMatches.length > 0) {
        retrievedContext = topMatches.map((match, i) => {
          const meta = match.metadata || {};
          const citation = meta.citation || meta.fileName || 'Unknown Source';
          sourceCitations.push(citation);
          return `[Source ${i + 1}: ${citation}]\n${meta.text || 'No text available'}`;
        }).join('\n\n---\n\n');
        
        console.log(`📚 RAG: Retrieved ${topMatches.length} relevant documents`);
      } else {
        retrievedContext = '⚠️ No relevant documents found in knowledge base.';
        console.log('📚 RAG: No matches found');
      }
    } catch (ragError) {
      console.error('⚠️ RAG retrieval failed:', ragError.message);
      retrievedContext = '⚠️ Unable to retrieve sources — knowledge base unavailable.';
    }
    
    // === COMPLIANCE-FIRST SYSTEM PROMPT ===
    const systemPrompt = `You are a compliance-first AI assistant supporting a licensed Florida health insurance agent during live calls.

YOUR ROLE:
- Surface SHORT, CITABLE suggestions from authoritative regulatory sources
- The licensed agent makes ALL decisions — you are decision-support only
- NEVER interpret law, guess, or generate sales language

RETRIEVED CONTEXT FROM KNOWLEDGE BASE:
${retrievedContext}

RESPONSE RULES:
1. Use ONLY information from the retrieved context above
2. Include citations: [Source: DocumentName] or [Source: §Section]
3. If information is missing, unclear, or no sources retrieved → respond with: "⚠️ Needs verification — escalate to compliance"
4. Keep suggestions to 1-2 bullet points, under 20 words each
5. Be direct and actionable
6. If customer say "Hi" or "Hello" respond with "Hi, how can I help you today?"

FORMAT:
• [Actionable suggestion] — [Source: Citation]
• ⚠️ Escalate: [reason] (if needed)

FORBIDDEN:
- Do NOT guess or hallucinate facts
- Do NOT interpret or paraphrase regulations
- Do NOT write verbatim scripts for the agent
- Do NOT answer compliance questions without a source citation

If the retrieved context does not contain relevant information, respond ONLY with:
"⚠️ No relevant sources found. Needs verification — escalate to compliance."`;

    // Generate AI suggestion with Gemini
    const chatModel = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      systemInstruction: systemPrompt,
      generationConfig: {
        maxOutputTokens: 200,
        temperature: 0.3 // Lower temperature for more factual responses
      }
    });

    const chatResult = await chatModel.generateContent(
      `Recent conversation:\n${conversationContext}\n\nClient just said: "${userMessage}"\n\nWhat should the agent say or do? Remember to cite sources.`
    );

    const aiSuggestion = chatResult.response.text();
    
    // Send AI suggestion to admins only
    broadcastToAdmins(meetingId, {
      type: 'ai-suggestion',
      suggestion: aiSuggestion,
      relatedTo: userMessage,
      sources: sourceCitations,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error generating AI response:', error);
  }
}

async function handleManualAISuggestion(data, connectionId) {
  const { meetingId, text, userId } = data;
  console.log(`🤖 Manual AI suggestion requested for ${userId}: "${text}"`);
  await generateAIResponse(meetingId, text, userId);
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

// === CRM & LEAD INTAKE ROUTES ===

/**
 * POST /api/leads/intake
 * Receives intake data (product, state, triggers, UTMs)
 * Returns a leadId (session ID)
 */
app.post('/api/leads/intake', async (req, res) => {
  try {
    const { 
      productType, 
      state, 
      triggers, 
      utm_source, 
      utm_medium, 
      utm_campaign,
      contactInfo // Optional: { email, phone, firstName, lastName }
    } = req.body;

    // 1. Create Lead Session
    const leadId = await leadSessionStore.createSession({
      productType,
      state: state || 'FL',
      triggers: triggers || [],
      utm: { utm_source, utm_medium, utm_campaign },
      contactInfo: contactInfo || {}
    });

    console.log(`📥 New Lead Intake: ${leadId} (${productType} in ${state})`);

    // 2. If contact info exists, sync to GHL immediately
    if (contactInfo && contactInfo.email) {
      try {
        const contact = await ghlService.createContact({
          email: contactInfo.email,
          phone: contactInfo.phone,
          firstName: contactInfo.firstName,
          lastName: contactInfo.lastName,
          tags: [`Lead Source: ${utm_source || 'Direct'}`, `Product: ${productType}`],
          customFields: {
            state: state,
            triggers: JSON.stringify(triggers)
          }
        });
        
        // Update session with GHL ID
        await leadSessionStore.updateSession(leadId, { ghlContactId: contact.id });
        console.log(`✅ Synced lead ${leadId} to GHL: ${contact.id}`);
      } catch (ghlError) {
        console.error('⚠️ Failed to sync to GHL:', ghlError.message);
        // Continue, don't fail the request
      }
    }

    res.json({ success: true, leadId });
  } catch (error) {
    console.error('Error in lead intake:', error);
    res.status(500).json({ error: 'Failed to process intake' });
  }
});

/**
 * GET /api/leads/:leadId
 * Retrieve lead context for the frontend
 */
app.get('/api/leads/:leadId', async (req, res) => {
  const session = await leadSessionStore.getSession(req.params.leadId);
  if (!session) {
    return res.status(404).json({ error: 'Lead session not found' });
  }
  res.json(session);
});

/**
 * POST /api/leads/:leadId/wrapup
 * Submit post-call disposition and notes
 */
app.post('/api/leads/:leadId/wrapup', async (req, res) => {
  try {
    const { leadId } = req.params;
    const { disposition, notes, planName, premium } = req.body;
    
    const session = await leadSessionStore.getSession(leadId);
    if (!session) {
      return res.status(404).json({ error: 'Lead session not found' });
    }

    // 1. Update Session
    const updatedSession = await leadSessionStore.updateSession(leadId, {
      disposition,
      notes,
      planName,
      premium,
      callEndedAt: new Date()
    });

    console.log(`📝 Wrap-up for lead ${leadId}: ${disposition}`);

    // 2. Sync to GHL if we have a contact ID
    if (session.ghlContactId) {
      try {
        // Update fields
        await ghlService.updateContact(session.ghlContactId, {
          customFields: {
            disposition: disposition,
            last_call_notes: notes,
            plan_sold: planName,
            premium_amount: premium
          },
          tags: [`Disposition: ${disposition}`]
        });

        // Add a note to the timeline
        // Note: The GHL API for notes might differ, usually /contacts/:id/notes
        // For now, we'll just log it or if ghlService supported it.
        // Let's assume ghlService.updateContact adds notes in a specific field or we skip explicit note endpoint for now.
        
        console.log(`✅ Synced wrap-up to GHL: ${session.ghlContactId}`);
      } catch (ghlError) {
        console.error('⚠️ Failed to sync wrap-up to GHL:', ghlError.message);
      }
    }

    res.json({ success: true, session: updatedSession });
  } catch (error) {
     console.error('Error in wrap-up:', error);
     res.status(500).json({ error: 'Failed to submit wrap-up' });
  }
});

// ==========================================

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// ========== Document Management Dashboard APIs ==========

/**
 * GET /api/documents/stats - Ingestion service statistics
 */
app.get('/api/documents/stats', async (req, res) => {
  try {
    const ingestionStats = autoIngestionService.getStats();
    
    // Get live Pinecone vector count
    let pineconeStats = { totalRecordCount: 0, namespaces: {} };
    try {
      pineconeStats = await pineconeService.getStats();
    } catch (e) {
      // Non-critical
    }
    
    res.json({
      ingestion: ingestionStats,
      pinecone: {
        totalVectors: pineconeStats.totalRecordCount || 0,
        namespaces: pineconeStats.namespaces || {}
      }
    });
  } catch (error) {
    console.error('Error fetching document stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats', message: error.message });
  }
});

/**
 * GET /api/documents/files - List of all processed files
 */
app.get('/api/documents/files', (req, res) => {
  try {
    const files = autoIngestionService.getProcessedFiles();
    res.json({ files });
  } catch (error) {
    console.error('Error fetching document files:', error);
    res.status(500).json({ error: 'Failed to fetch files', message: error.message });
  }
});

/**
 * POST /api/documents/reprocess - Remove tracking for a file so it re-processes
 */
app.post('/api/documents/reprocess', (req, res) => {
  try {
    const { fileKey } = req.body;
    
    if (!fileKey) {
      return res.status(400).json({ error: 'fileKey is required' });
    }
    
    const files = autoIngestionService.getProcessedFiles();
    const file = files.find(f => f.key === fileKey);
    
    if (!file) {
      return res.status(404).json({ error: 'File not found in tracking' });
    }
    
    // Remove from tracking (will be re-processed on next poll)
    autoIngestionService.processedFiles.delete(fileKey);
    autoIngestionService.saveProcessedFiles();
    
    console.log(`🔄 File "${file.fileName}" marked for re-processing`);
    
    res.json({ 
      success: true, 
      message: `File "${file.fileName}" will be re-processed on next poll cycle`,
      fileName: file.fileName
    });
  } catch (error) {
    console.error('Error scheduling reprocess:', error);
    res.status(500).json({ error: 'Failed to schedule reprocess', message: error.message });
  }
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
