import google.generativeai as genai
from app.core.config import settings
import time

class EmbeddingService:
    def __init__(self):
        self.api_key = settings.GEMINI_API_KEY
        if self.api_key:
            genai.configure(api_key=self.api_key)
        self.model = 'models/embedding-001' # or 'models/text-embedding-004' depending on availability
        self.dimensions = 768

    async def generate_embedding(self, text: str):
        try:
            result = genai.embed_content(
                model=self.model,
                content=text,
                task_type="retrieval_document"
            )
            # Truncate if needed (Gemini embeddings are usually 768)
            embedding = result['embedding']
            return embedding[:self.dimensions]
        except Exception as e:
            print(f"Embedding error: {e}")
            return None

    async def generate_embeddings_batch(self, texts: list):
        # Gemini batch embedding might have limits, doing loop for safety or use batch method if available
        embeddings = []
        for text in texts:
            emb = await self.generate_embedding(text)
            embeddings.append(emb)
            # Rate limit protection
            time.sleep(0.5) 
        return embeddings

embedding_service = EmbeddingService()
