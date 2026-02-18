import requests
import logging
from typing import List, Dict, Any, Optional
from urllib.parse import urlparse
from app.core.config import settings
from app.core.microsoft_auth import microsoft_auth

logger = logging.getLogger(__name__)

class SharePointService:
    def __init__(self):
        self.site_url = settings.SHAREPOINT_SITE_URL
        self.kb_dev_id = "KB-DEV" # Hardcoded default or env
        self.kb_prod_id = "KB-PROD"
        
        # Folder mapping to regulatory universes
        self.folders = [
            { "name": "00_TrainingReference", "universe": "training-reference" },
            { "name": "01_FL_State_Authority", "universe": "fl-state-authority" },
            { "name": "02_CMS_Medicare_Authority", "universe": "cms-medicare" },
            { "name": "03_Federal_ACA_Authority", "universe": "federal-aca" },
            { "name": "04_ERISA_IRS_SelfFunded", "universe": "erisa-irs-selffunded" },
            { "name": "05_FL_Medicaid_Agency", "universe": "fl-medicaid-agency" },
            { "name": "06_Carrier_FMO_Policies", "universe": "carrier-fmo-policies" }
        ]

    def _get_headers(self) -> Dict[str, str]:
        token = microsoft_auth.get_access_token()
        return {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }

    def get_site_info(self) -> Dict[str, Any]:
        """Get site information via Graph API"""
        try:
            headers = self._get_headers()
            
            # If full URL provided, extract site path
            site_path = self.site_url
            if "sharepoint.com" in site_path:
                parsed = urlparse(site_path)
                site_path = parsed.path
            
            # Graph API call to get site by path
            # /sites/{hostname}:/{server-relative-path}
            # Or /sites/root:{path}
            # Node.js uses /sites/root:{path}
            
            url = f"https://graph.microsoft.com/v1.0/sites/root:{site_path}"
            logger.info(f"Connecting to SharePoint site: {url}")
            
            response = requests.get(url, headers=headers)
            response.raise_for_status()
            site = response.json()
            
            logger.info(f"Connected to SharePoint site: {site.get('displayName')}")
            return site
            
        except Exception as e:
            logger.error(f"Error getting site info: {str(e)}")
            raise

    def get_document_library(self, library_name: str = "KB-DEV") -> Dict[str, Any]:
        """Find the document library (Drive) by name"""
        try:
            site = self.get_site_info()
            site_id = site["id"]
            
            headers = self._get_headers()
            url = f"https://graph.microsoft.com/v1.0/sites/{site_id}/drives"
            
            response = requests.get(url, headers=headers)
            response.raise_for_status()
            drives = response.json().get("value", [])
            
            # Find the KB library
            library = next((d for d in drives if library_name in d["name"]), None)
            
            if not library:
                raise ValueError(f"Library '{library_name}' not found")
                
            logger.info(f"Found document library: {library['name']}")
            return library
            
        except Exception as e:
            logger.error(f"Error getting library: {str(e)}")
            raise

    def list_folders(self, library_name: str = "KB-DEV") -> List[Dict[str, Any]]:
        """List all folders in the library root"""
        try:
            library = self.get_document_library(library_name)
            drive_id = library["id"]
            
            headers = self._get_headers()
            url = f"https://graph.microsoft.com/v1.0/drives/{drive_id}/root/children"
            params = {
                "$select": "id,name,folder,size,lastModifiedDateTime"
            }
            
            response = requests.get(url, headers=headers, params=params)
            response.raise_for_status()
            items = response.json().get("value", [])
            
            folders = [item for item in items if "folder" in item]
            logger.info(f"Found {len(folders)} folders in {library_name}")
            return folders
            
        except Exception as e:
            logger.error(f"Error listing folders: {str(e)}")
            raise

    def list_documents_in_folder(self, folder_name: str, library_name: str = "KB-DEV") -> List[Dict[str, Any]]:
        """List all supported documents in a specific folder"""
        try:
            library = self.get_document_library(library_name)
            drive_id = library["id"]
            
            headers = self._get_headers()
            # Path based addressing: /drives/{drive-id}/root:/{path}:/children
            url = f"https://graph.microsoft.com/v1.0/drives/{drive_id}/root:/{folder_name}:/children"
            params = {
                "$select": "id,name,file,size,lastModifiedDateTime,@microsoft.graph.downloadUrl",
                "$expand": "listItem($expand=fields)"
            }
            
            response = requests.get(url, headers=headers, params=params)
            response.raise_for_status()
            items = response.json().get("value", [])
            
            supported_exts = ['.pdf', '.docx', '.xlsx', '.xls', '.txt', '.md', '.csv']
            
            documents = []
            for item in items:
                if "file" not in item:
                    continue
                    
                filename = item["name"].lower()
                if not any(filename.endswith(ext) for ext in supported_exts):
                    continue
                    
                doc_details = {
                    "id": item["id"],
                    "driveId": drive_id,
                    "name": item["name"],
                    "size": item["size"],
                    "lastModified": item["lastModifiedDateTime"],
                    "downloadUrl": item.get("@microsoft.graph.downloadUrl"),
                    "metadata": self._extract_metadata(item, folder_name)
                }
                documents.append(doc_details)
                
            logger.info(f"Found {len(documents)} document(s) in {folder_name}")
            return documents
            
        except Exception as e:
            logger.error(f"Error listing documents in {folder_name}: {str(e)}")
            # Don't strictly crash if one folder fails, but re-raise for now
            raise

    def _extract_metadata(self, item: Dict[str, Any], folder_name: str) -> Dict[str, Any]:
        """Extract metadata from SharePoint list item fields"""
        fields = item.get("listItem", {}).get("fields", {})
        return {
            "state": fields.get("State"),
            "productUniverse": fields.get("ProductUniverse"),
            "regulator": fields.get("Regulator"),
            "authorityLevel": fields.get("AuthorityLevel"),
            "effectiveDate": fields.get("EffectiveDate"),
            "docVersion": fields.get("DocVersion"),
            "topicTags": fields.get("TopicTags", []),
            "carrier": fields.get("Carrier"),
            "citationPrefix": fields.get("CitationPrefix"),
            "folderName": folder_name
        }

    def download_document(self, download_url: Optional[str], drive_id: str, item_id: str) -> bytes:
        """Download document content"""
        try:
            import time
            retries = 3
            
            # 1. Try direct download URL with retries
            if download_url:
                for attempt in range(retries):
                    try:
                        response = requests.get(download_url)
                        if response.status_code == 200:
                            return response.content
                        elif response.status_code == 503:
                            logger.warning(f"503 Service Unavailable (Attempt {attempt+1}/{retries}). Retrying...")
                            time.sleep(2 * (attempt + 1))
                        else:
                            break # Go to fallback
                    except Exception as e:
                        logger.warning(f"Download error (Attempt {attempt+1}/{retries}): {e}")
            
            # 2. Fallback to Graph API
            if drive_id and item_id:
                headers = self._get_headers()
                url = f"https://graph.microsoft.com/v1.0/drives/{drive_id}/items/{item_id}/content"
                for attempt in range(retries):
                    try:
                        response = requests.get(url, headers=headers)
                        if response.status_code == 503:
                            logger.warning(f"Graph API 503 (Attempt {attempt+1}/{retries}). Retrying...")
                            time.sleep(2 * (attempt + 1))
                            continue
                        response.raise_for_status()
                        return response.content
                    except Exception as e:
                         if attempt == retries - 1:
                             raise
                         time.sleep(2)
                         
            raise ValueError("No download URL and no drive/item ID provided (or all attempts failed)")
            
        except Exception as e:
            logger.error(f"Error downloading document: {str(e)}")
            raise

sharepoint_service = SharePointService()
