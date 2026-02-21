# Insurance AI Consultant - Python Backend

This is the migrated Python backend using **FastAPI** and **Supabase**.

## Prerequisites
- Python 3.10+
- Supabase Project

## Setup

1.  **Create Virtual Environment**:
    ```bash
    python -m venv venv
    .\venv\Scripts\activate  # Windows
    # source venv/bin/activate # Mac/Linux
    ```

2.  **Install Dependencies**:
    ```bash
    pip install -r requirements.txt
    ```

3.  **Environment Variables**:
    - Copy `.env.example` to `.env`
    - Fill in your `SUPABASE_URL`, `SUPABASE_KEY`, `GEMINI_API_KEY`, etc.
    - For higher-accuracy meeting transcription, set:
      - `DEEPGRAM_API_KEY`
      - `MEETING_STT_PROVIDER=deepgram`
      - `MEETING_DEEPGRAM_STREAMING=true`
      - `MEETING_DEEPGRAM_KEEPALIVE_SEC=4`
      - `MEETING_DEEPGRAM_ENDPOINTING_MS=300`
      - `MEETING_DEEPGRAM_UTTERANCE_END_MS=1000`
      - `MEETING_DEEPGRAM_DRAFT_EMIT_INTERVAL_MS=280`
      - `MEETING_DEEPGRAM_MIN_CONFIDENCE=0.45`

## Running the Server

```bash
uvicorn app.main:app --reload --port 8000
```

## Deploy Backend To Railway

Use this repo's `python-backend` folder as the Railway service root.

1. Create a new Railway project and connect your GitHub repo.
2. In the Railway service settings:
   - Set **Root Directory** to `python-backend`
   - Keep builder as **Nixpacks**
   - Start command is already defined in `Procfile`/`railway.toml`
3. Add environment variables in Railway (copy from your local `.env`):
   - `DATABASE_URL`
   - `SUPABASE_URL`
   - `SUPABASE_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `GEMINI_API_KEY`
   - `PINECONE_API_KEY`
   - `PINECONE_INDEX_NAME`
   - `MICROSOFT_CLIENT_ID`
   - `MICROSOFT_TENANT_ID`
   - `MICROSOFT_CLIENT_SECRET`
   - `SHAREPOINT_SITE_URL`
   - `DEEPGRAM_API_KEY`
   - Meeting/STT tuning vars from `.env.example` as needed
   - `CORS_ORIGINS` as JSON array including your Vercel domain
     - Example: `["https://your-frontend.vercel.app","http://localhost:5173"]`
4. Deploy and wait for status = healthy.
5. Verify backend:
   - `https://<your-railway-domain>/health`
   - `https://<your-railway-domain>/docs`

### Connect Vercel Frontend To Railway Backend

In Vercel project environment variables, set:

- `VITE_API_URL=https://<your-railway-domain>`
- `VITE_WS_URL=wss://<your-railway-domain>`

Then redeploy frontend. This ensures REST + WebSocket meeting traffic both go to Railway.

## API Documentation

Once running, visit:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Project Structure

- `app/api`: API Endpoints (Leads, Meetings, etc.)
- `app/core`: Configuration & Supabase Client
- `app/schemas`: Pydantic Models (Data Validation)
- `app/services`: Business Logic (RAG, Integrations, WebSocket)
