import io
import mammoth
from pdfminer.high_level import extract_text

class DocumentProcessor:
    def __init__(self):
        pass

    def process_txt(self, content: bytes) -> str:
        return content.decode("utf-8", errors="ignore")

    async def process_pdf(self, content: bytes) -> str:
        try:
            # pdfminer.six synchronous call, wrap in thread if cpu bound?
            # It's CPU bound, but for small files ok.
            # Best practice: run_in_executor
            import asyncio
            loop = asyncio.get_event_loop()
            text = await loop.run_in_executor(None, extract_text, io.BytesIO(content))
            return text
        except Exception as e:
            print(f"Error processing PDF: {e}")
            return ""
    
    async def process_docx(self, content: bytes) -> str:
        try:
            # mammoth is sync
            import asyncio
            loop = asyncio.get_event_loop()
            
            def _extract(c):
                result = mammoth.extract_raw_text(io.BytesIO(c))
                return result.value
                
            text = await loop.run_in_executor(None, _extract, content)
            return text
        except Exception as e:
            print(f"Error processing DOCX: {e}")
            return ""

document_processor = DocumentProcessor()
