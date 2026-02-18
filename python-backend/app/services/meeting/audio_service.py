import os
import io
import wave
import base64
import asyncio
import google.generativeai as genai
from typing import Dict, Any, List
from app.core.config import settings
from app.services.meeting.websocket_manager import manager
from app.services.integrations.pinecone import pinecone_service
from app.services.llm.embeddings import embedding_service

# Configure Gemini
if settings.GEMINI_API_KEY:
    genai.configure(api_key=settings.GEMINI_API_KEY)

class AudioService:
    def __init__(self):
        # meeting_id -> { user_id -> bytearray }
        self.buffers: Dict[str, Dict[str, bytearray]] = {}
        # meeting_id -> { user_id -> bool }
        self.is_processing: Dict[str, Dict[str, bool]] = {}
        
        self.model_name = "gemini-1.5-flash"
        
        # Audio constants (must match frontend)
        self.SAMPLE_RATE = 16000
        self.CHANNELS = 1
        self.SAMPLE_WIDTH = 2 # 16-bit
        # Process every ~6-8 seconds. 16kHz * 2 bytes * 8s = 256KB
        # Lowering to 10KB for testing
        self.PROCESS_THRESHOLD = 10000 

    def _get_buffer(self, meeting_id: str, user_id: str) -> bytearray:
        if meeting_id not in self.buffers:
            self.buffers[meeting_id] = {}
        if user_id not in self.buffers[meeting_id]:
            self.buffers[meeting_id][user_id] = bytearray()
        return self.buffers[meeting_id][user_id]

    def _clear_buffer(self, meeting_id: str, user_id: str):
        if meeting_id in self.buffers and user_id in self.buffers[meeting_id]:
            self.buffers[meeting_id][user_id] = bytearray()

    async def process_audio_chunk(self, meeting_id: str, user_id: str, base64_audio: str):
        """
        Receive audio chunk, decode, append to buffer.
        If buffer is full, trigger processing.
        """
        try:
            audio_bytes = base64.b64decode(base64_audio)
            
            # Use lock logic if needed, but dict ops are atomic in GIL/asyncio usually safe for this
            if meeting_id not in self.buffers:
                self.buffers[meeting_id] = {}
            if user_id not in self.buffers[meeting_id]:
                self.buffers[meeting_id][user_id] = bytearray()
                
            self.buffers[meeting_id][user_id].extend(audio_bytes)
            
            # Check threshold
            current_size = len(self.buffers[meeting_id][user_id])
            
            # Check processing flag
            is_busy = self.is_processing.get(meeting_id, {}).get(user_id, False)
            
            if current_size >= self.PROCESS_THRESHOLD and not is_busy:
                # Extract buffer and process
                audio_to_process = bytes(self.buffers[meeting_id][user_id])
                self._clear_buffer(meeting_id, user_id)
                
                # Set busy flag
                if meeting_id not in self.is_processing:
                    self.is_processing[meeting_id] = {}
                self.is_processing[meeting_id][user_id] = True
                
                # Offload to background task to not block WebSocket loop
                asyncio.create_task(self.handle_transcription(meeting_id, user_id, audio_to_process))
                
        except Exception as e:
            print(f"Error processing audio chunk: {e}")

    async def handle_transcription(self, meeting_id: str, user_id: str, pcm_data: bytes):
        try:
            print(f"🎤 Transcribing {len(pcm_data)} bytes for {user_id}...")
            wav_data = self.pcm_to_wav(pcm_data)
            
            # Gemini Call
            model = genai.GenerativeModel(self.model_name)
            
            # Gemini explicitly needs mime_type for inline data
            response = await model.generate_content_async([
                {
                    "mime_type": "audio/wav",
                    "data": wav_data
                },
                "Transcribe this audio exactly. Return ONLY the spoken words. If silence, return empty string."
            ])
            
            text = response.text.strip()
            
            if text:
                print(f"📝 Transcription: {text}")
                
                # 1. Broadcast Transcription
                await manager.broadcast_to_admin(meeting_id, {
                    "type": "transcription",
                    "userId": user_id,
                    "text": text,
                    "timestamp": "now" # In real app use ISO format
                })
                
                # 2. Generate AI Suggestion (only if text is long enough)
                if len(text) > 10:
                    await self.generate_ai_suggestion(meeting_id, user_id, text)
                    
        except Exception as e:
            print(f"Transcription error: {e}")
        finally:
            # Clear busy flag
            if meeting_id in self.is_processing and user_id in self.is_processing[meeting_id]:
                self.is_processing[meeting_id][user_id] = False

    async def generate_ai_suggestion(self, meeting_id: str, user_id: str, text: str):
        try:
            # RAG Lookup
            embedding = await embedding_service.generate_embedding(text)
            if not embedding:
                 return

            # Query namespaces
            namespaces = [
                'training-reference',
                'fl-state-authority', 
                'cms-medicare'
                # Add others as needed
            ]
            
            context_results = []
            for ns in namespaces:
                matches = pinecone_service.query(embedding, ns, top_k=2)
                for m in matches:
                    context_results.append(f"[Source: {ns}]\n{m.metadata.get('text', '')}")
            
            # Format Context
            retrieved_context = "\n\n".join(context_results[:5]) # limit context
            if not retrieved_context:
                retrieved_context = "No specific regulatory documents found."

            # System Prompt
            system_prompt = """
            You are a compliance-first AI insurance assistant. 
            Your role is to guide the agent based on the provided context.
            Suggest a SHORT, compliant response or action.
            Cite the source if available in context.
            """
            
            user_prompt = f"""
            Context from Knowledge Base:
            {retrieved_context}
            
            Customer just said: "{text}"
            
            Provide a short suggestion for the agent:
            """
            
            model = genai.GenerativeModel(self.model_name)
            response = await model.generate_content_async(system_prompt + user_prompt)
            
            suggestion = response.text.strip()
            
            # Broadcast Suggestion
            await manager.broadcast_to_admin(meeting_id, {
                "type": "ai-suggestion",
                "suggestion": suggestion,
                "relatedTo": text
            })
            
        except Exception as e:
            print(f"AI Suggestion error: {e}")

    def pcm_to_wav(self, pcm_bytes: bytes) -> bytes:
        with io.BytesIO() as wav_io:
            with wave.open(wav_io, 'wb') as wav_file:
                wav_file.setnchannels(self.CHANNELS)
                wav_file.setsampwidth(self.SAMPLE_WIDTH)
                wav_file.setframerate(self.SAMPLE_RATE)
                wav_file.writeframes(pcm_bytes)
            return wav_io.getvalue()

audio_service = AudioService()
