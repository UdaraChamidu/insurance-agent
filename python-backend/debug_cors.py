from app.core.config import settings
print(f"Type: {type(settings.CORS_ORIGINS)}")
print(f"Value: {settings.CORS_ORIGINS}")
for origin in settings.CORS_ORIGINS:
    print(f" - {origin} (type: {type(origin)})")
