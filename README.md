# Insurance AI Consultant Platform

A specialized video consultation platform for insurance agents, featuring real-time AI assistance, compliance gating, and CRM integration.

## 🌟 Key Features

### 🔹 For Clients
- **Smart Intake Flow**: Personalized questionnaire to capture product interest (Medicare, ACA, Life) and critical triggers (Turning 65, Moved, etc.).
- **Dynamic Scheduling**: Automatically routes clients to the correct specialist calendar based on their intake needs.
- **Seamless Video**: No-download WebRTC video calls directly in the browser.

### 🔹 For Agents
- **AI Copilot**: Real-time transcription and compliance suggestions during calls (requires OpenAI key).
- **Compliance Scripts**: Automatically loads the correct legal disclaimers and scripts based on the client's product type.
- **Wrap-Up & CRM Sync**: Integrated "Wrap Up" form to log call outcome (Booked, Quoted, NI) and sync structured data to GoHighLevel (GHL).
- **RAG Knowledge Base**: Instant access to carrier policies and regulations via the "Ask AI" panel.

---

## 🛠️ Tech Stack

- **Frontend**: React (Vite), Tailwind CSS, Lucide Icons
- **Backend**: Node.js (Express), Socket.io (WebSocket)
- **Database**: Pinecone (Vector DB), In-Memory Session Store (for active leads)
- **Integrations**: OpenAI (GPT-4/Whisper), Microsoft Graph (Bookings/SharePoint), GoHighLevel (CRM), Twilio (SMS).

---

## 🚀 Getting Started

### Prerequisites
- Node.js v18+
- API Keys for OpenAI, Pinecone, Microsoft Graph (Optional for full features), GoHighLevel (Optional for CRM sync).

### 1. Installation

**Backend:**
```bash
cd backend
npm install
```

**Frontend:**
```bash
cd frontend
npm install
```

### 2. Environment Variables

Create reference `.env` files in both directories.

**Backend (`backend/.env`):**
```env
PORT=3001
# AI (Optional)
OPENAI_API_KEY=sk-...
PINECONE_API_KEY=...
PINECONE_INDEX=insurance-agent

# CRM (GoHighLevel)
GHL_API_KEY=...
GHL_LOCATION_ID=...

# Microsoft (Bookings/SharePoint)
MICROSOFT_CLIENT_ID=...
MICROSOFT_TENANT_ID=...
MICROSOFT_CLIENT_SECRET=...
SHAREPOINT_SITE_URL=...

# Twilio (Optional)
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=...
```

**Frontend (`frontend/.env`):**
```env
VITE_API_URL=http://localhost:3001
VITE_WS_URL=ws://localhost:3001
```

### 3. Running Locally

**Start Backend:**
```bash
cd backend
npm start
```
*Server runs on port 3001.*

**Start Frontend:**
```bash
cd frontend
npm run dev
```
*App runs on http://localhost:5173*.

---

## 🚢 Deployment Guide

### Frontend (Vercel)
The frontend is a static React app and is best deployed on **Vercel**.
1.  Connect your GitHub repo to Vercel.
2.  Set `Build Command`: `npm run build`
3.  Set `Output Directory`: `dist`
4.  **Environment Variables**:
    - `VITE_API_URL`: Your production backend URL (e.g., `https://my-backend.railway.app`)
    - `VITE_WS_URL`: Your production backend websocket (e.g., `wss://my-backend.railway.app`)

### Backend (Railway)
The backend is a Node.js service. We verify it works best with Docker on **Railway**.
1.  Connect your GitHub repo to Railway.
2.  Railway matches the `Dockerfile` automatically (Node 20 Alpine).
3.  **Environment Variables**: Add all variables from your `backend/.env` to the Railway service settings.
4.  **Networking**: Railway will provide a public domain. Use this for the Frontend's `VITE_API_URL`.

---

## 🧪 Testing the Flow

1.  **Intake**: Go to `/intake`. Fill out the form.
    - *Simulates ad click and lead capture.*
2.  **Scheduling**: (Redirects to `/schedule`).
    - *Note: Microsoft Booking iframe may block on localhost/non-production domains.*
3.  **Consultation**: Agent joins via `/meeting?meetingId=test&role=admin`.
    - Verify "Scripts & Tools" tab loads the correct script for the lead's product.
    - Click "Wrap Up" to save call outcome.
