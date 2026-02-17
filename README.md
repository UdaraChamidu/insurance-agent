# 🏥 Insurance AI Consultant Platform

**A "Smart" Video Consultation & Intake System for Insurance Agents.**

This platform streamlines the entire lifecycle of selling insurance—from the moment a lead clicks an ad, to the final policy binding—ensuring compliance and efficiency at every step.

---

## 🔄 How It Works (The User Journey)

### 1. The "Smart" Intake (`/intake`)
Instead of a generic contact form, clients go through a **dynamic questionnaire**:
- **Product Filtering**: Accurately buckets leads into *Medicare*, *ACA (Obamacare)*, or *Life Insurance*.
- **State Validity**: Checks if the agent is licensed in the client's state (default: FL).
- **Trigger Capture**: Identifies high-intent signals (e.g., "Turning 65 soon", "Just moved").
- **Result**: Creates a **Lead Session** in Supabase and syncs a "New Lead" contact to **GoHighLevel (CRM)**.

### 2. Intelligent Scheduling
Once a lead is qualified, they don't just see a generic calendar. The system routes them to the **specific Microsoft Booking calendar** for their product type (e.g., a "Medicare Specialist" calendar vs. a "Family Plan" calendar).

### 3. The Consultation Room (`/meeting`)
The agent and client meet in a custom video room (WebRTC) that gives the agent **Superpowers**:
- **Script Panel**: Automatically loads the *exact* compliance script required for the client's product (e.g., CMS Disclaimer for Medicare).
- **Compliance Checklist**: Interactive checklist to ensure no required disclosures are missed.
- **Agent Tools**: Quick access to carrier-specific lookups and cheat sheets.
- *(Future)* **AI Copilot**: Live transcription and RAG-based answer suggestions.

### 4. The Wrap-Up & Sync
When the call ends, the agent fills out a **Wrap-Up Form** directly in the dashboard:
- **Disposition**: What happened? (Sold, Quoted, Not Interested).
- **Notes**: Key details from the call.
- **Sync**: One click saves everything to:
    1.  **Supabase** (Permanent Database).
    2.  **GoHighLevel** (Updates the contact tags, notes, and pipeline stage).

---

## 🧠 System Architecture

### 📂 The "Brain" (Knowledge Base)
- **SharePoint Integration**: The system watches specific SharePoint folders (e.g., `02_CMS_Medicare_Authority`).
- **Auto-Ingestion**: When a new PDF/Doc is uploaded to SharePoint, the backend automatically downloads, chunks, and embeds it into **Pinecone**.
- **Result**: The agent (and future AI) has instant access to the latest carrier policies and state regulations.

### 🗄️ The Database (Supabase + Prisma)
We moved away from temporary memory to a robust PostgreSQL setup:
- **Leads**: Stores intake data and UTM parameters.
- **Sessions**: Tracks call start/end times and status.
- **Transcripts**: (Prepared) Stores conversation history for AI analysis.

---

## 🚀 Developer Setup

### Prerequisites
- Node.js v18+
- Supabase Project (PostgreSQL)
- *(Optional)*: OpenAI API Key, GoHighLevel API Key, Microsoft Graph Credentials

### 1. Installation
```bash
# Backend
cd backend
npm install
npx prisma generate  # Generate DB client

# Frontend
cd frontend
npm install
```

### 2. Environment Variables (`.env`)
You need a `.env` file in `backend/` with at least:
```env
PORT=3001
DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres"
# Add OpenAI/GHL keys for full features
```

### 3. Running Locally
```bash
# Terminal 1 (Backend)
cd backend
npm start

# Terminal 2 (Frontend)
cd frontend
npm run dev
```
Visit `http://localhost:5173` to start.

---

## 🗺️ Roadmap

- [x] **Phase 1**: Core Intake & CRM Sync
- [x] **Phase 2**: Agent Dashboard & Scripts
- [x] **Phase 3**: RAG / Document Ingestion
- [x] **Phase 4**: Database Persistence (Supabase)
- [ ] **Phase 5**: AI Intelligence (Live Transcription & Suggestions)
- [ ] **Phase 6**: Twilio Voice Integration (Phone Calls)
