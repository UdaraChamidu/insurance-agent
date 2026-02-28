# Trigger reload
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware
from app.core.config import settings
from app.api.v1.api import api_router

app = FastAPI(
    title="Insurance AI Consultant API",
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url="/docs",
    redoc_url="/redoc",
)

# Honor X-Forwarded-* headers from Railway so generated redirect URLs keep https.
app.add_middleware(ProxyHeadersMiddleware, trusted_hosts="*")

# Set CORS enabled origins (always-on for stable local development + configurable origins)
default_local_origins = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
]
configured_origins = []
try:
    configured_origins = [str(origin).rstrip("/") for origin in (settings.CORS_ORIGINS or [])]
except Exception as cors_origin_error:
    print(f"CORS config parse warning: {cors_origin_error}")

allowed_origins = sorted(set(default_local_origins + configured_origins))
print(f"CORS Allowed Origins: {allowed_origins}")
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.API_V1_STR)

@app.on_event("startup")
async def startup_event():
    # Create any new database tables
    from app.core.database import engine, Base
    from app.models import Lead, Session, Transcript, Notification, Appointment, AvailabilitySlot
    Base.metadata.create_all(bind=engine)

    # Add missing columns to existing tables (create_all won't alter existing tables)
    from sqlalchemy import text
    with engine.connect() as conn:
        migrations = [
            ("Lead", "pipelineStatus", "VARCHAR DEFAULT 'new'"),
            ("Appointment", "bookingRef", "VARCHAR UNIQUE"),
            ("Appointment", "manageToken", "VARCHAR UNIQUE"),
            # Session migrations
            ("Session", "callSummary", "TEXT"),
            ("Session", "recordingLink", "VARCHAR"),
            ("Session", "transcriptLink", "VARCHAR"),
            ("Session", "citationsBundleLink", "VARCHAR"),
            ("Session", "complianceFlags", "JSONB"), # Postgres JSONB is better, but sqlalchemy JSON maps to JSON usually. Using JSON for broader compat if needed but usually text/json is fine. Let's stick to generic types for safety in raw SQL if we don't know dialect perfectly, but JSON usually works in PG.
            ("Session", "actionItems", "JSONB"),
        ]
        for table, column, col_type in migrations:
            try:
                conn.execute(text(
                    f'ALTER TABLE "{table}" ADD COLUMN IF NOT EXISTS "{column}" {col_type}'
                ))
                conn.commit()
            except Exception as e:
                print(f"Migration note ({table}.{column}): {e}")

    print("✅ Database tables synced")

    from app.services.document.poller import document_poller
    from app.services.appointment_reminder_poller import appointment_reminder_poller
    await document_poller.start()
    await appointment_reminder_poller.start()

@app.on_event("shutdown")
async def shutdown_event():
    from app.services.document.poller import document_poller
    from app.services.appointment_reminder_poller import appointment_reminder_poller
    await document_poller.stop()
    await appointment_reminder_poller.stop()

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "insurance-ai-backend-python"}

@app.get("/health/latency")
def health_latency():
    from app.services.meeting.audio_service import audio_service
    return {
        "status": "ok",
        "service": "insurance-ai-backend-python",
        "latency": audio_service.get_latency_snapshot(),
    }
