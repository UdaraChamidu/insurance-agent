from typing import Optional, Dict, Any
import logging
import msal
from app.core.config import settings

logger = logging.getLogger(__name__)

class MicrosoftAuthService:
    def __init__(self):
        self.client_id = settings.MICROSOFT_CLIENT_ID
        self.client_secret = settings.MICROSOFT_CLIENT_SECRET
        self.tenant_id = settings.MICROSOFT_TENANT_ID
        
        if not self.client_id or not self.client_secret or not self.tenant_id:
            logger.warning("Microsoft credentials not fully configured.")
            self.is_configured = False
            return
            
        self.is_configured = True
        
        self.authority = f"https://login.microsoftonline.com/{self.tenant_id}"
        self.scopes = ["https://graph.microsoft.com/.default"]
        
        self.app = msal.ConfidentialClientApplication(
            self.client_id,
            authority=self.authority,
            client_credential=self.client_secret,
        )
        
        logger.info("Microsoft Authentication Service initialized")

    def get_access_token(self) -> str:
        if not self.is_configured:
            raise ValueError("Microsoft credentials not configured")
            
        # Check cache first (MSAL handles this internally securely)
        result = self.app.acquire_token_silent(self.scopes, account=None)

        if not result:
            logger.info("Requesting new access token from Microsoft...")
            result = self.app.acquire_token_for_client(scopes=self.scopes)

        if "access_token" in result:
            return result["access_token"]
        else:
            error_msg = result.get("error_description", "Unknown error")
            logger.error(f"Failed to acquire token: {error_msg}")
            raise Exception(f"Failed to acquire access token: {error_msg}")

    def is_ready(self) -> bool:
        return self.is_configured

# Singleton instance
microsoft_auth = MicrosoftAuthService()
