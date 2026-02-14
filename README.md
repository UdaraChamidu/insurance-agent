# Insurance AI Consultation Platform

A real-time video consultation platform with AI-powered transcription and agent assistance for insurance consultations.
  
## 🎯 Features

- **Public Website**: Insurance company landing page with meeting scheduling
- **Microsoft Booking Integration**: Seamless appointment scheduling 
- **Custom WebRTC Video**: High-quality, low-latency video conferencing
- **Real-time Transcription**: Using OpenAI Whisper API
- **AI Agent Assistance**: GPT-4 provides real-time suggestions and compliance checks
- **RAG Knowledge Base**: Integration with SharePoint for accessing regulatory documents
- **Admin Dashboard**: Monitor conversations with live transcription and AI insights

## 📋 Prerequisites

Before you begin, ensure you have the following installed/configured:

- **Node.js**: v18 or higher
- **OpenAI API Key**: With access to GPT-4 and Whisper
- **Pinecone Account**: For vector database (RAG)
- **Microsoft 365 Account**: For SharePoint access and App Registration (Azure)

## 🛠️ Setup & Installation

### 1. Backend Setup

The backend handles the WebSocket server, AI processing, and RAG ingestion.

1.  Navigate to the backend directory:
    ```bash
    cd backend
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

3.  Configure environment variables:
    - Create a `.env` file based on the example:
      ```bash
      cp .env.example .env
      ```
    - Open `.env` and fill in your credentials:
      - `OPENAI_API_KEY`: Your OpenAI key
      - `PINECONE_API_KEY`: Your Pinecone API key
      - `MICROSOFT_CLIENT_ID`: Azure App Client ID
      - `MICROSOFT_TENANT_ID`: Azure Tenant ID
      - `MICROSOFT_CLIENT_SECRET`: Azure Client Secret
      - `SHAREPOINT_SITE_URL`: URL to your SharePoint site

4.  **Ingest Knowledge Base** (Optional but recommended for AI context):
    This script processes PDFs from SharePoint and uploads them to Pinecone.
    ```bash
    npm run ingestion
    # OR directly:
    node run-ingestion.js
    ```

5.  Run the backend server:
    ```bash
    npm run dev
    ```
    The server typically runs on `http://localhost:3001`.

### 2. Frontend Setup

The frontend provides the user interfaces for clients and agents.

1.  Navigate to the frontend directory:
    ```bash
    cd frontend
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

3.  Configure environment variables:
    - Create a `.env` file:
      ```bash
      cp .env.example .env
      ```
    - Ensure variables point to your backend:
      ```env
      VITE_API_URL=http://localhost:3001
      VITE_WS_URL=ws://localhost:3001
      ```

4.  Run the frontend development server:
    ```bash
    npm run dev
    ```
    The application will be accessible at `http://localhost:3000`.

## 🚀 Usage Guide

### Running the Application Locally
Ideally, you should have **two terminal windows** open:

**Terminal 1 (Backend):**
```bash
cd backend
npm run dev
```

**Terminal 2 (Frontend):**
```bash
cd frontend
npm run dev
```

### Accessing the Platform

- **Client/Public Site**: Visit `http://localhost:3000` to schedule or join a mock meeting.
- **Admin Dashboard**: Visit `http://localhost:3000/admin`
    - Default Password: `admin123` (Configured in `frontend/src/pages/AdminPage.jsx`)
    - From here, you can generate meeting links and view the agent cockpit.

## 📄 Documentation Info

- `QUICKSTART.md`: Tries to get you up and running in 5 minutes.
- `ARCHITECTURE.md`: Technical details about the system.
- `VERCEL_DEPLOYMENT.md` / `RAILWAY_DEPLOYMENT.md`: Instructions for deploying to production.

## 🤝 Contributing

This is a private project. For questions or issues, contact the development team.
