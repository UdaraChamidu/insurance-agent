import google.generativeai as genai
from app.core.config import settings
import asyncio
from app.services.llm.usage_tracker import gemini_usage_tracker

class EmbeddingService:
    def __init__(self):
        self.api_key = settings.GEMINI_API_KEY
        if self.api_key:
            genai.configure(api_key=self.api_key)
        self.model = 'models/embedding-001' # Fallback to 001 if 004 fails
        # Actually list_models showed 'models/gemini-embedding-001'
        self.model = 'models/gemini-embedding-001'
        self.dimensions = 768

    async def generate_embedding(self, text: str):
        retries = 3
        for attempt in range(retries):
            try:
                result = genai.embed_content(
                    model=self.model,
                    content=text,
                    task_type="retrieval_document"
                )
                gemini_usage_tracker.record_response(
                    operation="embedding",
                    response_payload=result,
                    request_text=text,
                )
                embedding = result['embedding']
                return embedding[:self.dimensions]
            except Exception as e:
                gemini_usage_tracker.record_error("embedding", e)
                if "429" in str(e) or "quota" in str(e).lower():
                    wait_time = 30 * (attempt + 1)
                    print(f"Rate limit hit. Waiting {wait_time}s...")
                    await asyncio.sleep(wait_time)
                else:
                    print(f"Embedding error: {e}")
                    return None
        return None

    async def generate_embeddings_batch(self, texts: list):
        embeddings = []
        for text in texts:
            emb = await self.generate_embedding(text)
            embeddings.append(emb)
            # Stricter rate limiting for free tier
            await asyncio.sleep(1.5)  # Max 40 req/min
        return embeddings

embedding_service = EmbeddingService()
