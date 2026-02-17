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

## Running the Server

```bash
uvicorn app.main:app --reload --port 8000
```

## API Documentation

Once running, visit:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Project Structure

- `app/api`: API Endpoints (Leads, Meetings, etc.)
- `app/core`: Configuration & Supabase Client
- `app/schemas`: Pydantic Models (Data Validation)
- `app/services`: Business Logic (RAG, Integrations, WebSocket)
