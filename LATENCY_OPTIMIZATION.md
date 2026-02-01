# Audio Processing & Latency Optimization Guide

## Overview

This guide explains how to optimize the real-time audio transcription pipeline for minimal latency while maintaining accuracy.

## Current Architecture

```
Client Microphone
    ↓ (WebRTC)
Audio Capture (16kHz, mono)
    ↓ (every 2 seconds)
Float32 → Int16 → Base64
    ↓ (WebSocket)
Backend Server
    ↓
Base64 → Audio Buffer
    ↓
OpenAI Whisper API
    ↓
Transcription Text
    ↓
OpenAI GPT-4 API
    ↓
AI Suggestion
    ↓ (WebSocket)
Admin Dashboard
```

## Latency Breakdown

| Stage | Current Latency | Optimization Potential |
|-------|----------------|----------------------|
| Audio Capture | 2000ms | 500-3000ms |
| Network Transfer | 50-200ms | Minimal |
| Whisper API | 500-2000ms | Model selection |
| GPT-4 API | 1000-3000ms | Model/context optimization |
| Total | ~3.5-7s | **Target: 1-3s** |

## Optimization Strategies

### 1. Audio Chunk Size (HIGH IMPACT)

**Current**: 2 seconds
**Options**:

```javascript
// In frontend/src/services/meetingService.js

// OPTION A: Lower latency (1 second chunks)
const SEND_INTERVAL = CHUNKS_PER_SECOND * 1;
// Pros: Faster response (1-3s total)
// Cons: More API calls, higher cost, may reduce accuracy

// OPTION B: Current (2 second chunks)
const SEND_INTERVAL = CHUNKS_PER_SECOND * 2;
// Pros: Good balance
// Cons: Moderate latency

// OPTION C: Higher accuracy (3 second chunks)
const SEND_INTERVAL = CHUNKS_PER_SECOND * 3;
// Pros: Better transcription, fewer API calls
// Cons: Higher latency (4-8s total)
```

**Recommendation**: Start with 2s, adjust based on needs.

### 2. Sample Rate Optimization

**Current**: 16kHz (good for speech)
**Options**:

```javascript
// In frontend/src/services/meetingService.js
audio: {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  sampleRate: 16000  // Options: 8000, 16000, 24000, 48000
}

// 8kHz  - Fastest, phone quality, sufficient for speech
// 16kHz - Balanced, good quality (RECOMMENDED)
// 48kHz - High quality, slower processing
```

### 3. Voice Activity Detection (VAD)

Add silence detection to only send audio when speaking:

```javascript
// Add to meetingService.js

function detectVoiceActivity(audioData) {
  // Calculate RMS (Root Mean Square) energy
  let sum = 0;
  for (let i = 0; i < audioData.length; i++) {
    sum += audioData[i] * audioData[i];
  }
  const rms = Math.sqrt(sum / audioData.length);
  
  // Threshold for speech (adjust based on testing)
  const SPEECH_THRESHOLD = 0.02;
  return rms > SPEECH_THRESHOLD;
}

// In onaudioprocess
this.audioProcessor.onaudioprocess = (e) => {
  if (!this.isRecording) return;
  
  const inputData = e.inputBuffer.getChannelData(0);
  const audioData = new Float32Array(inputData);
  
  // Only process if voice detected
  if (detectVoiceActivity(audioData)) {
    audioChunks.push(audioData);
    chunkCount++;
    
    if (chunkCount >= SEND_INTERVAL) {
      this.sendAudioChunk(audioChunks);
      audioChunks = [];
      chunkCount = 0;
    }
  }
};
```

**Benefits**:
- Reduces unnecessary API calls
- Lowers costs
- Slightly reduces latency

### 4. Streaming Transcription (ADVANCED)

For absolute minimal latency, implement streaming:

```javascript
// Future enhancement: Use OpenAI's streaming API
const stream = await openai.audio.transcriptions.create({
  file: audioFile,
  model: 'whisper-1',
  stream: true  // Enable streaming
});

for await (const chunk of stream) {
  // Send partial transcription immediately
  broadcastToAdmins(meetingId, {
    type: 'partial-transcription',
    text: chunk.text
  });
}
```

### 5. Model Selection

**Whisper Models**:
- `whisper-1`: General purpose (current)

**GPT Models**:

```javascript
// In backend/src/server.js

// OPTION A: Fastest response
model: 'gpt-3.5-turbo'
// Latency: ~500-1500ms
// Quality: Good for simple suggestions
// Cost: $0.0015/1K tokens

// OPTION B: Better quality (current)
model: 'gpt-4-turbo-preview'
// Latency: ~1000-3000ms
// Quality: Excellent suggestions
// Cost: $0.01/1K tokens

// OPTION C: Latest and fastest GPT-4
model: 'gpt-4o-mini'
// Latency: ~800-2000ms
// Quality: Very good
// Cost: Lower than GPT-4
```

### 6. Context Window Optimization

Reduce GPT context for faster responses:

```javascript
// In generateAIResponse function

// Current: Last 10 transcriptions
const recentTranscriptions = meeting.transcriptions.slice(-10);

// Optimized: Last 5 transcriptions
const recentTranscriptions = meeting.transcriptions.slice(-5);

// Even faster: Just the current message
const conversationContext = userMessage;
```

### 7. Parallel Processing

Process transcription and AI generation in parallel:

```javascript
async function processAudioForTranscription(meetingId, audioBuffer, userId) {
  const meeting = meetings.get(meetingId);
  if (!meeting) return;
  
  try {
    const audioFile = new File([audioBuffer], 'audio.webm', { type: 'audio/webm' });
    
    // Start transcription
    const transcriptionPromise = openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1'
    });
    
    // Get last user message for early AI processing
    const lastMessage = meeting.transcriptions[meeting.transcriptions.length - 1];
    
    // Process in parallel
    const [transcription, aiPrep] = await Promise.all([
      transcriptionPromise,
      lastMessage ? prepareAIContext(meeting) : Promise.resolve(null)
    ]);
    
    // Continue with AI generation
    await generateAIResponse(meetingId, transcription.text, userId);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    meeting.isTranscribing = false;
  }
}
```

### 8. Caching Common Responses

Cache frequent topics:

```javascript
const responseCache = new Map();

async function generateAIResponse(meetingId, userMessage, userId) {
  // Check cache for similar messages
  const cacheKey = userMessage.toLowerCase().trim();
  if (responseCache.has(cacheKey)) {
    const cached = responseCache.get(cacheKey);
    // Send cached response immediately
    broadcastToAdmins(meetingId, {
      type: 'ai-suggestion',
      suggestion: cached.suggestion,
      cached: true
    });
    return;
  }
  
  // Generate new response
  // ... existing code ...
  
  // Cache the response
  responseCache.set(cacheKey, { suggestion: aiSuggestion });
}
```

### 9. Audio Compression

Compress audio before sending:

```javascript
// Add to package.json
"dependencies": {
  "opus-recorder": "^8.0.3"
}

// Use Opus codec for better compression
// Reduces network transfer time
```

### 10. Regional Deployment

Deploy backend closer to users:

**Railway**:
- Select region closest to target users
- Options: US-West, US-East, Europe, Asia-Pacific

**OpenAI**:
- API requests routed automatically
- Consider Azure OpenAI for specific regions

## Recommended Configuration

### For Minimal Latency (< 2 seconds)

```javascript
// meetingService.js
const SEND_INTERVAL = CHUNKS_PER_SECOND * 1;  // 1 second chunks
sampleRate: 16000  // 16kHz

// server.js
model: 'gpt-3.5-turbo'  // Fast model
const recentTranscriptions = meeting.transcriptions.slice(-3);  // Less context
```

### For Best Quality

```javascript
// meetingService.js
const SEND_INTERVAL = CHUNKS_PER_SECOND * 3;  // 3 second chunks
sampleRate: 16000  // 16kHz

// server.js
model: 'gpt-4-turbo-preview'  // Best model
const recentTranscriptions = meeting.transcriptions.slice(-10);  // More context
```

### For Balanced (Recommended)

```javascript
// meetingService.js
const SEND_INTERVAL = CHUNKS_PER_SECOND * 2;  // 2 second chunks
sampleRate: 16000  // 16kHz

// server.js
model: 'gpt-4o-mini'  // Good balance
const recentTranscriptions = meeting.transcriptions.slice(-5);  // Moderate context
```

## Monitoring Latency

Add latency tracking:

```javascript
// In backend
async function processAudioForTranscription(meetingId, audioBuffer, userId) {
  const startTime = Date.now();
  
  try {
    const transcription = await openai.audio.transcriptions.create(/*...*/);
    const transcriptionTime = Date.now() - startTime;
    
    const aiStartTime = Date.now();
    await generateAIResponse(meetingId, transcription.text, userId);
    const aiTime = Date.now() - aiStartTime;
    
    console.log(`Latency - Transcription: ${transcriptionTime}ms, AI: ${aiTime}ms, Total: ${transcriptionTime + aiTime}ms`);
  } catch (error) {
    console.error('Error:', error);
  }
}
```

## Testing Different Configurations

Create a configuration file:

```javascript
// backend/src/config.js
export const config = {
  audio: {
    chunkDuration: process.env.AUDIO_CHUNK_DURATION || 2, // seconds
    sampleRate: process.env.AUDIO_SAMPLE_RATE || 16000
  },
  ai: {
    model: process.env.AI_MODEL || 'gpt-4o-mini',
    contextLength: process.env.AI_CONTEXT_LENGTH || 5,
    maxTokens: process.env.AI_MAX_TOKENS || 150
  }
};
```

Then test different values via environment variables.

## Cost vs Latency Trade-offs

| Configuration | Latency | Cost/Hour | Quality |
|---------------|---------|-----------|---------|
| Ultra Fast | 1-2s | $0.50 | Good |
| Balanced | 2-4s | $0.30 | Very Good |
| High Quality | 4-7s | $0.20 | Excellent |

## Best Practices

1. **Start Balanced**: Use 2-second chunks with GPT-4o-mini
2. **Monitor**: Track actual latency in production
3. **Iterate**: Adjust based on real user feedback
4. **A/B Test**: Test configurations with real agents
5. **Regional**: Deploy close to users
6. **Cache**: Implement caching for common scenarios
7. **VAD**: Add voice activity detection to reduce costs

## Future Enhancements

1. **Edge Processing**: Process audio on edge servers
2. **Custom Models**: Fine-tune models for insurance domain
3. **Predictive AI**: Start generating suggestions before full transcription
4. **WebAssembly**: Client-side audio preprocessing
5. **HTTP/3**: Faster network protocol support
