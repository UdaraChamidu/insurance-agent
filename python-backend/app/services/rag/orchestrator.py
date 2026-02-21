from app.services.integrations.pinecone import pinecone_service
from app.services.llm.embeddings import embedding_service
from app.services.rag.chunking import chunking_service
from app.services.rag.processors import document_processor

class IngestionOrchestrator:
    def __init__(self):
        pass

    async def process_file_content(self, content: bytes, filename: str, folder_name: str, namespace: str):
        """
        Full RAG Pipeline: Extract -> Chunk -> Embed -> Upsert
        """
        print(f"Processing {filename} for namespace {namespace}...")
        
        # 1. Extract Text
        text = ""
        if filename.endswith(".txt"):
            text = document_processor.process_txt(content)
        elif filename.endswith(".pdf"):
            text = await document_processor.process_pdf(content)
        elif filename.endswith(".docx"):
            text = await document_processor.process_docx(content)
        else:
            print(f"Unsupported file type: {filename}")
            return 0, 0

        # 2. Chunk
        chunks = chunking_service.chunk_text(text, metadata={"filename": filename, "folder": folder_name})
        if not chunks:
            print("No text extracted to chunk.")
            return 0, 0

        # 3. Embed & Upsert Batch
        # For simplicity, doing one by one or small batches
        texts = [c["text"] for c in chunks]
        embeddings = await embedding_service.generate_embeddings_batch(texts)
        
        vectors = []
        for i, chunk in enumerate(chunks):
            if i < len(embeddings) and embeddings[i]:
                vectors.append({
                    "id": f"{filename}_chunk_{i}",
                    "values": embeddings[i],
                    "metadata": {
                        "text": chunk["text"],
                        **chunk["metadata"]
                    }
                })
        
        if vectors:
            success = pinecone_service.upsert(vectors, namespace)
            if success:
                print(f"Successfully upserted {len(vectors)} chunks to Pinecone.")
                return len(chunks), len(vectors)
            else:
                print("Failed to upsert to Pinecone.")
                return len(chunks), 0
        
        return 0, 0

ingestion_orchestrator = IngestionOrchestrator()
