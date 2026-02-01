# Technical Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT BROWSER                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌─────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │  Public Website │  │ Client Meeting   │  │ Admin Dashboard  │  │
│  │  (React/Vite)   │  │   Interface      │  │   (Real-time)    │  │
│  └────────┬────────┘  └────────┬─────────┘  └────────┬─────────┘  │
│           │                     │                      │             │
│           │                     │                      │             │
└───────────┼─────────────────────┼──────────────────────┼─────────────┘
            │                     │                      │
            │ HTTP/S              │ WebSocket (WSS)      │
            │                     │ WebRTC (SRTP)        │
            ▼                     ▼                      │
┌─────────────────────────────────────────────────────────────────────┐
│                      VERCEL EDGE NETWORK                             │
│                    (Static Hosting + CDN)                            │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    RAILWAY BACKEND SERVER                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    Express.js Server                          │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │  │
│  │  │   HTTP API   │  │  WebSocket   │  │  WebRTC Signaling│  │  │
│  │  │   Endpoints  │  │   Server     │  │     Server       │  │  │
│  │  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘  │  │
│  └─────────┼──────────────────┼───────────────────┼────────────┘  │
│            │                  │                   │                 │
│            │                  │                   │                 │
│  ┌─────────▼──────────────────▼───────────────────▼────────────┐  │
│  │              Audio Processing Pipeline                       │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────────┐  │  │
│  │  │  Receive │→ │  Buffer  │→ │ Convert  │→ │   Queue   │  │  │
│  │  │  Chunks  │  │  Audio   │  │  Format  │  │   Jobs    │  │  │
│  │  └──────────┘  └──────────┘  └──────────┘  └───────────┘  │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                   Meeting Management                         │  │
│  │  - Active meetings Map                                       │  │
│  │  - Participant tracking                                      │  │
│  │  - Transcription history                                     │  │
│  │  - Connection management                                     │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             │ HTTPS API Calls
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         OPENAI API                                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌──────────────────────────┐    ┌──────────────────────────────┐  │
│  │    Whisper API           │    │       GPT-4 API              │  │
│  │  (Speech-to-Text)        │    │  (AI Suggestions)            │  │
│  │                          │    │                              │  │
│  │  Input: Audio chunks     │    │  Input: Conversation context │  │
│  │  Output: Transcription   │    │  Output: Agent suggestions   │  │
│  └──────────────────────────┘    └──────────────────────────────┘  │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

## Component Details

### Frontend (Vercel)

**Technology Stack**:
- React 18
- Vite (Build tool)
- TailwindCSS (Styling)
- React Router (Navigation)
- SimplePeer (WebRTC)

**Pages**:
1. **HomePage** (`/`)
   - Landing page
   - Insurance company information
   - CTA to schedule meetings

2. **SchedulePage** (`/schedule`)
   - Microsoft Booking integration
   - Appointment scheduling
   - Client information collection

3. **MeetingPage** (`/meeting?meetingId=xxx`)
   - Client video interface
   - WebRTC video/audio
   - Simple controls

4. **AdminPage** (`/admin`)
   - Admin login
   - Meeting list
   - Meeting creation

5. **AdminDashboard** (`/admin/dashboard?meetingId=xxx`)
   - Real-time video
   - Live transcription feed
   - AI suggestions overlay
   - Meeting controls

**Services**:
- `meetingService.js`: WebRTC + WebSocket management

### Backend (Railway)

**Technology Stack**:
- Node.js 18+
- Express.js (HTTP server)
- WS (WebSocket library)
- OpenAI SDK

**Core Modules**:

1. **WebSocket Server**
   ```javascript
   - Connection management
   - Message routing
   - Real-time communication
   ```

2. **WebRTC Signaling**
   ```javascript
   - Offer/Answer exchange
   - ICE candidate exchange
   - Peer connection setup
   ```

3. **Audio Processing**
   ```javascript
   - Receive audio chunks
   - Buffer management
   - Format conversion
   - Queue processing
   ```

4. **OpenAI Integration**
   ```javascript
   - Whisper API calls
   - GPT-4 API calls
   - Response streaming
   - Error handling
   ```

5. **Meeting Management**
   ```javascript
   - Meeting lifecycle
   - Participant tracking
   - State management
   - Cleanup
   ```

## Data Flow

### 1. Meeting Setup

```
Client → Schedule (Microsoft Booking)
       → Receive email with meeting link
       → Click link → MeetingPage
       
Admin → Admin Dashboard → View scheduled meetings
      → Click "Join Meeting" → AdminDashboard
```

### 2. WebRTC Connection

```
Client A (Browser)                 Backend                 Client B (Admin)
      │                               │                            │
      ├──── join-meeting ────────────>│                            │
      │                               ├──── join-meeting ──────────>│
      │                               │                            │
      │<──── participant-joined ──────┤                            │
      │                               │<──── participant-joined ───┤
      │                               │                            │
      ├──── create offer ────────────>│                            │
      │                               ├──── relay offer ──────────>│
      │                               │                            │
      │                               │<──── create answer ────────┤
      │<──── relay answer ────────────┤                            │
      │                               │                            │
      ├──── ICE candidates ──────────>│                            │
      │                               ├──── relay candidates ─────>│
      │                               │                            │
      │<════════════════ P2P WebRTC Connection ═══════════════════>│
```

### 3. Real-time Transcription

```
Client Microphone
      │
      ▼
Audio Capture (WebRTC MediaStream)
      │
      ▼
ScriptProcessor (4096 samples)
      │
      ▼
Buffer Audio (2 seconds)
      │
      ▼
Convert Float32 → Int16 → Base64
      │
      ▼ WebSocket
Backend Server
      │
      ▼
Decode Base64 → Audio Buffer
      │
      ▼
Create File Object
      │
      ▼ HTTPS
OpenAI Whisper API
      │
      ▼
Transcription Text
      │
      ▼ WebSocket
Admin Dashboard (Display)
      │
      ▼
Prepare Context (Last 5-10 messages)
      │
      ▼ HTTPS
OpenAI GPT-4 API
      │
      ▼
AI Suggestion
      │
      ▼ WebSocket
Admin Dashboard (Overlay Display)
```

## Security Architecture

### 1. Network Security

```
Client ←→ Vercel (HTTPS/WSS) ←→ Railway (HTTPS/WSS) ←→ OpenAI (HTTPS)
         └─ TLS 1.3            └─ TLS 1.3            └─ TLS 1.3
         └─ HSTS               └─ HSTS               └─ API Key Auth
```

### 2. Authentication Flow

```
Admin Login
      │
      ▼
Password Check (Simple)
      │
      ▼
Session Storage
      │
      ▼
Access Admin Routes
```

**Note**: In production, implement proper authentication:
- JWT tokens
- OAuth 2.0
- Session management
- Rate limiting

### 3. Data Privacy

- **Audio**: Never stored permanently
- **Transcriptions**: Stored in memory only during meeting
- **Recordings**: Not implemented (add if needed)
- **PII**: Handle according to privacy policy

## Scalability Considerations

### Current Limits

| Resource | Limit | Scaling Strategy |
|----------|-------|------------------|
| Concurrent Meetings | ~10 | Horizontal scaling |
| WebSocket Connections | ~100 | Load balancing |
| Audio Processing | CPU-bound | Vertical scaling |
| Memory | Meeting history | Clear old meetings |

### Horizontal Scaling

```
                        Load Balancer
                              │
                ┌─────────────┼─────────────┐
                ▼             ▼             ▼
          Backend-1     Backend-2     Backend-3
                │             │             │
                └─────────────┼─────────────┘
                              │
                         Shared State
                    (Redis or Database)
```

**To implement**:
1. Add Redis for shared state
2. Use Railway's auto-scaling
3. Implement sticky sessions for WebSocket

## Performance Metrics

### Target Metrics

| Metric | Target | Current |
|--------|--------|---------|
| Time to First Transcription | < 3s | ~3-5s |
| AI Suggestion Latency | < 2s | ~2-4s |
| Video Latency | < 300ms | ~200-500ms |
| WebSocket Latency | < 100ms | ~50-150ms |

### Monitoring Points

1. **Frontend**:
   - WebRTC connection time
   - Audio chunk send rate
   - WebSocket latency

2. **Backend**:
   - Audio processing queue length
   - OpenAI API response time
   - Active connections count

3. **External APIs**:
   - Whisper API latency
   - GPT-4 API latency
   - API error rates

## Database Schema (Future)

Currently using in-memory storage. For production:

```sql
-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email VARCHAR(255) UNIQUE,
  role VARCHAR(50),
  created_at TIMESTAMP
);

-- Meetings
CREATE TABLE meetings (
  id UUID PRIMARY KEY,
  scheduled_at TIMESTAMP,
  duration INTEGER,
  status VARCHAR(50),
  created_at TIMESTAMP
);

-- Transcriptions
CREATE TABLE transcriptions (
  id UUID PRIMARY KEY,
  meeting_id UUID REFERENCES meetings(id),
  user_id UUID REFERENCES users(id),
  text TEXT,
  timestamp TIMESTAMP
);

-- AI Suggestions
CREATE TABLE ai_suggestions (
  id UUID PRIMARY KEY,
  meeting_id UUID REFERENCES meetings(id),
  suggestion TEXT,
  context TEXT,
  timestamp TIMESTAMP
);
```

## API Reference

### REST Endpoints

#### Create Meeting
```
POST /api/meetings
Response: { meetingId: "uuid" }
```

#### Get Meeting Info
```
GET /api/meetings/:meetingId
Response: {
  id: "uuid",
  participants: 2,
  transcriptions: [...]
}
```

#### Health Check
```
GET /health
Response: { status: "ok" }
```

### WebSocket Events

#### Client → Server

**join-meeting**
```json
{
  "type": "join-meeting",
  "meetingId": "uuid",
  "userId": "user-123",
  "role": "client|admin"
}
```

**audio-chunk**
```json
{
  "type": "audio-chunk",
  "meetingId": "uuid",
  "userId": "user-123",
  "audioData": "base64..."
}
```

**offer/answer/ice-candidate**
```json
{
  "type": "offer|answer|ice-candidate",
  "meetingId": "uuid",
  "targetUserId": "user-456",
  "signal": {...}
}
```

#### Server → Client

**joined-meeting**
```json
{
  "type": "joined-meeting",
  "meetingId": "uuid",
  "participants": [...]
}
```

**transcription**
```json
{
  "type": "transcription",
  "userId": "user-123",
  "text": "...",
  "timestamp": "2024-01-15T10:00:00Z"
}
```

**ai-suggestion**
```json
{
  "type": "ai-suggestion",
  "suggestion": "...",
  "relatedTo": "...",
  "timestamp": "2024-01-15T10:00:00Z"
}
```

## Error Handling

### Frontend
```javascript
try {
  await meetingService.connect();
} catch (error) {
  // Show user-friendly error
  // Retry connection
  // Fall back to audio-only
}
```

### Backend
```javascript
try {
  await processAudio();
} catch (error) {
  console.error('Error:', error);
  // Send error to client
  // Continue processing other meetings
  // Alert monitoring system
}
```

## Deployment Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                        GitHub Repo                            │
│                                                                │
│  ┌──────────────┐              ┌─────────────────┐          │
│  │   /frontend  │              │    /backend     │          │
│  │   (React)    │              │   (Node.js)     │          │
│  └──────┬───────┘              └────────┬────────┘          │
│         │                                │                    │
└─────────┼────────────────────────────────┼────────────────────┘
          │                                │
          │ Push                           │ Push
          ▼                                ▼
┌──────────────────┐           ┌───────────────────────┐
│     Vercel       │           │      Railway          │
│  - Auto Deploy   │           │   - Auto Deploy       │
│  - Edge Network  │           │   - WebSocket Support │
│  - CDN           │           │   - Auto Scaling      │
└──────────────────┘           └───────────────────────┘
```

## Tech Stack Summary

| Layer | Technology | Purpose |
|-------|-----------|----------|
| Frontend Framework | React 18 + Vite | UI Development |
| Styling | TailwindCSS | Responsive Design |
| Routing | React Router | Navigation |
| WebRTC | SimplePeer | Video/Audio |
| Backend Runtime | Node.js 18+ | Server |
| Web Server | Express.js | HTTP/WebSocket |
| WebSocket | ws library | Real-time Comm |
| Speech-to-Text | OpenAI Whisper | Transcription |
| AI | OpenAI GPT-4 | Suggestions |
| Frontend Host | Vercel | Static Hosting |
| Backend Host | Railway | Container Hosting |
| Scheduling | Microsoft Booking | Appointments |
