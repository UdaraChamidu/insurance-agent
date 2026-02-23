# Insurance AI Consultant Platform

A full-stack meeting and sales-assist platform for insurance teams.

It combines:
- lead intake and appointment booking,
- real-time client meetings (video + audio),
- live transcription,
- AI assist with RAG (Gemini + Pinecone),
- meeting artifact storage (transcript, AI responses, summary),
- admin workflows for leads, clients, and knowledge-base management.

## What This Project Solves

Insurance consultations are time-sensitive and compliance-sensitive.  
This platform helps an admin/agent:
- understand client needs in real time,
- get fast AI-assisted responses grounded in internal documents,
- keep a structured record of calls,
- move leads through a clear pipeline,
- reduce manual note-taking and follow-up overhead.

## Core Features

### 1. Public Client Flow
- `Home` page for public entry.
- `Intake` form to collect product type, contact details, and context.
- `Schedule` page for appointment booking with timezone support.
- Public appointment management links (cancel/reschedule by token).
- Client meeting join via secure meeting link.

### 2. Admin Workspace
- Admin layout with dedicated sections:
  - Appointments
  - Clients
  - Lead Pipeline
  - Knowledge Base
  - Settings
- Client profile page with:
  - profile details,
  - meeting artifacts,
  - AI notes,
  - uploaded documents.

### 3. Real-Time Meeting Experience
- WebRTC for audio/video between client and admin.
- WebSocket signaling and event transport.
- Real-time client speech transcription.
- AI suggestions shown in admin meeting panel.
- Split panel meeting UI with resizable sections.
- Wrap-up flow with:
  - summary generation,
  - download options (JSON/CSV),
  - save-to-database actions.

### 4. AI + RAG Assist
- Speech-to-text pipeline (Deepgram configurable).
- Gemini response generation with retrieval context.
- Pinecone-backed knowledge retrieval across namespaces.
- Draft/final response modes for low-latency assist.
- Verification warning when no strong sources are found.

### 5. Knowledge Base and Document Pipeline
- SharePoint document polling and ingestion.
- Auto extract/chunk/embed/upsert pipeline to Pinecone.
- Tracks processed/processing/error/no-vector states.
- Admin visibility for ingestion status and vector counts.
- Reprocess endpoint for targeted re-ingestion.

### 6. Persistence and Integrations
- PostgreSQL (Supabase) for core app data.
- Optional integrations for:
  - SharePoint (Microsoft Graph),
  - Pinecone,
  - Deepgram,
  - Gemini,
  - Twilio,
  - GoHighLevel.

## High-Level Architecture

Client/Admin Browser
-> React app (Vite)
-> FastAPI backend (`/api`, `/api/meetings/ws`)
-> External services:
- Deepgram (STT),
- Gemini (LLM/embeddings),
- Pinecone (vector search),
- Supabase Postgres + Storage,
- SharePoint (document source),
- Optional CRM/communications providers.

### Meeting Data Path (Simplified)
1. Client speaks in browser.
2. Audio is captured and streamed to backend over WebSocket.
3. Backend runs STT and emits transcription to admin.
4. Transcription triggers AI assist pipeline with RAG retrieval.
5. AI suggestions stream to admin panel.
6. Transcription + AI + full chat + summary can be persisted and exported.

## Tech Stack

### Frontend
- React 18
- Vite
- Tailwind CSS
- React Router
- WebRTC + WebSocket client logic

### Backend
- FastAPI
- SQLAlchemy
- Uvicorn
- Pydantic / pydantic-settings

### Data / AI / Integrations
- Supabase (Postgres + Storage)
- Gemini (LLM + embeddings)
- Pinecone (vector DB)
- Deepgram (speech-to-text)
- Microsoft Graph / SharePoint
- Twilio (optional)
- GoHighLevel (optional)

## Repository Structure

```text
.
|-- frontend/
|   |-- src/
|   |   |-- pages/
|   |   |-- components/
|   |   |-- services/
|   |   `-- utils/
|   `-- package.json
|-- python-backend/
|   |-- app/
|   |   |-- api/v1/endpoints/
|   |   |-- services/
|   |   |-- models.py
|   |   `-- main.py
|   |-- tests/
|   |-- requirements.txt
|   |-- railway.toml
|   `-- Procfile
`-- README.md
```

## Local Development Setup

## Prerequisites
- Node.js 18+
- Python 3.10+
- A Postgres/Supabase database
- API keys for the services you plan to use

## 1) Backend Setup

```bash
cd python-backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

Create env file:

```bash
copy .env.example .env
```

Start backend:

```bash
uvicorn app.main:app --reload --port 8000
```

Health checks:
- `http://localhost:8000/health`
- `http://localhost:8000/docs`

## 2) Frontend Setup

```bash
cd frontend
npm install
```

Create env file:

```bash
copy .env.example .env
```

Start frontend:

```bash
npm run dev
```

App URL:
- `http://localhost:3000` (Vite config in this repo)

## Environment Variables

### Frontend (`frontend/.env`)
- `VITE_API_URL` -> backend base URL (HTTP local, HTTPS production)
- `VITE_WS_URL` -> backend WS base URL (WS local, WSS production)

### Backend (`python-backend/.env`) important keys
- App/core:
  - `PORT`
  - `ENVIRONMENT`
  - `CORS_ORIGINS`
- Database:
  - `DATABASE_URL`
  - `SUPABASE_URL`
  - `SUPABASE_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
- AI/RAG:
  - `GEMINI_API_KEY`
  - `PINECONE_API_KEY`
  - `PINECONE_INDEX_NAME`
- STT:
  - `DEEPGRAM_API_KEY`
  - `MEETING_STT_PROVIDER`
  - `MEETING_DEEPGRAM_*` tuning values
- SharePoint:
  - `MICROSOFT_CLIENT_ID`
  - `MICROSOFT_TENANT_ID`
  - `MICROSOFT_CLIENT_SECRET`
  - `SHAREPOINT_SITE_URL`

Use `python-backend/.env.example` as the canonical reference.

## Deployment

## Backend (Railway)

Use `python-backend` as Railway root directory.

This repo already includes:
- `python-backend/Procfile`
- `python-backend/railway.toml`

Expected start command:
- `uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}`

## Frontend (Vercel)

Use `frontend` as project root.

Recommended settings:
- Framework: Vite
- Build command: `npm run build`
- Output directory: `dist`
- Production branch: `main`

Production env vars:
- `VITE_API_URL=https://<your-railway-domain>`
- `VITE_WS_URL=wss://<your-railway-domain>`

## API Surface (Summary)

Base prefix: `/api`

Main groups:
- `/api/leads`
- `/api/meetings` + `/api/meetings/ws`
- `/api/scheduling`
- `/api/documents`
- `/api/admin/settings`
- `/api/notifications`
- `/api/client-docs`
- `/api/communications`
- `/api/health`

Interactive docs:
- `/docs`
- `/redoc`

## Data Model Overview

Main entities:
- `Lead`
- `Session`
- `Transcript`
- `Appointment`
- `AvailabilitySlot`
- `Document`
- `Notification`

These are defined in `python-backend/app/models.py`.

## Latency and Quality Tuning

Meeting responsiveness is controlled by:
- frontend audio buffering and send intervals,
- STT provider settings (`MEETING_DEEPGRAM_*`),
- AI trigger cadence (`MEETING_AI_*`),
- RAG thresholds (`MEETING_RAG_*`).

For lower latency:
- keep WS endpoint on `wss://` in production,
- avoid mixed-content redirects,
- tune STT endpointing/utterance settings carefully,
- monitor `/health/latency`.

## Troubleshooting

### 1) Mixed Content / Failed to fetch on leads or clients
Symptom:
- Browser blocks `http://...` API call from `https://` frontend.

Actions:
- Ensure frontend uses `https://` + `wss://` env vars in production.
- Ensure backend honors proxy headers (already configured in `app/main.py`).
- Verify deployed frontend bundle is latest (not stale hashed JS).

### 2) `/api/leads` redirect issues in production
Symptom:
- Redirect to non-secure URL can break browser requests.

Actions:
- Use trailing-slash endpoint call pattern where required.
- Keep proxy header middleware enabled so generated redirects use HTTPS.

### 3) Railway "No start command found"
Actions:
- Confirm root directory is `python-backend`.
- Keep `Procfile` / `railway.toml` committed.

### 4) Slow or missing live transcription
Actions:
- Verify `DEEPGRAM_API_KEY`.
- Check `MEETING_STT_PROVIDER=deepgram`.
- Tune endpointing/utterance/keepalive env values.
- Watch backend logs for Deepgram timeout errors.

## Testing

Backend tests:

```bash
cd python-backend
python -m pytest tests/test_audio_service.py -q
```

Frontend build check:

```bash
npm --prefix frontend run build
```

## Security and Compliance Notes

- Do not commit real API keys or secrets.
- Replace demo/simple admin auth with proper auth for production.
- Follow regional compliance requirements for call transcription and data retention.
- Obtain appropriate consent before recording/transcribing user conversations.

## Useful File References

- `frontend/src/pages/MeetingPage.jsx`
- `frontend/src/services/meetingService.js`
- `frontend/src/services/leadsService.js`
- `python-backend/app/main.py`
- `python-backend/app/api/v1/endpoints/meetings.py`
- `python-backend/app/services/meeting/audio_service.py`
- `python-backend/app/services/document/poller.py`
- `python-backend/app/services/rag/orchestrator.py`
- `python-backend/.env.example`

