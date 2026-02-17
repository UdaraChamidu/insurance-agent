import re
from typing import List

class ChunkingService:
    def __init__(self):
        self.chunk_size = 1000
        self.chunk_overlap = 200

    def chunk_text(self, text: str, metadata: dict = None) -> List[dict]:
        """
        Split text into overlapping chunks
        Returns list of { "text": str, "metadata": dict }
        """
        chunks = []
        if not text:
            return chunks

        start = 0
        text_len = len(text)

        while start < text_len:
            end = start + self.chunk_size
            chunk_text = text[start:end]
            
            # Simple metadata handling
            chunk_metadata = metadata.copy() if metadata else {}
            chunk_metadata["chunk_index"] = len(chunks)
            chunk_metadata["char_start"] = start
            chunk_metadata["char_end"] = end
            
            chunks.append({
                "text": chunk_text,
                "metadata": chunk_metadata
            })
            
            start += (self.chunk_size - self.chunk_overlap)
        
        return chunks

chunking_service = ChunkingService()
