from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.v1.api import api_router

app = FastAPI(
    title="Insurance AI Consultant API",
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url="/docs",
    redoc_url="/redoc",
)

# Set all CORS enabled origins
if settings.CORS_ORIGINS:
    print(f"CORS Allowed Origins: {settings.CORS_ORIGINS}")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[str(origin).rstrip("/") for origin in settings.CORS_ORIGINS],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

app.include_router(api_router, prefix=settings.API_V1_STR)

@app.on_event("startup")
async def startup_event():
    from app.services.document.poller import document_poller
    await document_poller.start()

@app.on_event("shutdown")
async def shutdown_event():
    from app.services.document.poller import document_poller
    await document_poller.stop()

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "insurance-ai-backend-python"}
