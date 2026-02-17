import sys
import os
import asyncio
from unittest.mock import MagicMock, patch

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Mock embedding service BEFORE importing orchestrator
# We need to patch the module where it is used or imported
# In app/services/rag/orchestrator.py, it imports embedding_service

async def mock_generate_embeddings_batch(texts):
    print(f"   [MOCK] Generating embeddings for {len(texts)} chunks...")
    # Return dummy 768-dim vectors (Gemini standard) or 1536 (OpenAI)
    # The user mentioned Gemini, so likely 768.
    return [[0.1] * 768 for _ in texts]

# Mock Pinecone service to avoid actual writes if key is missing or to just verify flow
class MockPinecone:
    def upsert(self, vectors, namespace):
        print(f"   [MOCK] Pinecone Upsert: {len(vectors)} vectors to namespace '{namespace}'")
        return True

async def run_verification():
    try:
        print("1. Setting up Mocks...")
        
        # Patch embedding service
        with patch('app.services.llm.embeddings.embedding_service') as mock_embed:
            mock_embed.generate_embeddings_batch.side_effect = mock_generate_embeddings_batch
            
            # Patch Pinecone service? 
            # Or we can let it run if key logic handles it. 
            # But to be safe and "dry run", let's mock it.
            with patch('app.services.integrations.pinecone.pinecone_service', new=MockPinecone()):
                
                from app.services.rag.orchestrator import ingestion_orchestrator
                from app.services.sharepoint_service import sharepoint_service
                
                print("\n2. Fetching a Document from SharePoint...")
                # Try to get a real file to test extraction
                library = "KB-DEV"
                folders = sharepoint_service.list_folders(library)
                if not folders:
                    print("   ❌ No folders found in KB-DEV")
                    return

                folder_name = folders[0]["name"]
                print(f"   Checking folder: {folder_name}")
                docs = sharepoint_service.list_documents_in_folder(folder_name, library)
                
                if not docs:
                    print("   ❌ No documents found to test.")
                    return
                    
                target_doc = docs[0]
                print(f"   Selected Document: {target_doc['name']} ({target_doc['size']} bytes)")
                
                print(f"\n3. Downloading {target_doc['name']}...")
                content = sharepoint_service.download_document(
                    target_doc.get("downloadUrl"), 
                    target_doc.get("driveId"), 
                    target_doc.get("id")
                )
                print(f"   Downloaded {len(content)} bytes.")
                
                print("\n4. Running RAG Pipeline (Mocked Embeddings/DB)...")
                # process_file(content, filename, folder_name, namespace)
                # namespace usually mapped from folder
                namespace = "training-reference" 
                
                await ingestion_orchestrator.process_file(
                    content, 
                    target_doc["name"], 
                    folder_name, 
                    namespace
                )
                
                print("\n✅ Verification Complete! (RAG Pipeline Logic is working)")

    except Exception as e:
        print(f"\n❌ VERIFICATION FAILED: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(run_verification())
