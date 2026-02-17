import sys
import os
import json
from dotenv import load_dotenv

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

load_dotenv(override=True)

try:
    from app.services.sharepoint_service import sharepoint_service
    
    print("1. Testing Microsoft Auth & Site Connection...")
    site = sharepoint_service.get_site_info()
    print(f"   Success! Site ID: {site.get('id')}")
    print(f"   Site Name: {site.get('displayName')}")
    
    print("\n2. Testing Library Access...")
    library = sharepoint_service.get_document_library("KB-DEV")
    print(f"   Success! Library ID: {library.get('id')}")
    
    print("\n3. Listing Folders...")
    folders = sharepoint_service.list_folders("KB-DEV")
    print(f"   Found {len(folders)} folders.")
    for f in folders[:3]:
        print(f"   - {f['name']}")
        
    if folders:
        first_folder = folders[0]["name"]
        print(f"\n4. Listing Documents in '{first_folder}'...")
        docs = sharepoint_service.list_documents_in_folder(first_folder, "KB-DEV")
        print(f"   Found {len(docs)} documents.")
        
        if docs:
            print(f"   Sample Document: {docs[0]['name']}")
            print(f"   Metadata: {json.dumps(docs[0]['metadata'], indent=2)}")

except Exception as e:
    print(f"\n❌ STARTUP FAILED: {str(e)}")
    import traceback
    traceback.print_exc()
