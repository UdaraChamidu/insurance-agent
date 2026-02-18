import asyncio
import unittest
from unittest.mock import MagicMock, patch, AsyncMock
import sys
import os

# Add app to path
sys.path.append(os.getcwd())

from app.services.meeting.audio_service import AudioService

class TestAudioService(unittest.IsolatedAsyncioTestCase):
    async def test_audio_processing_flow(self):
        # Mock dependencies
        with patch('app.services.meeting.audio_service.genai') as mock_genai, \
             patch('app.services.meeting.audio_service.manager') as mock_manager, \
             patch('app.services.meeting.audio_service.pinecone_service') as mock_pinecone, \
             patch('app.services.meeting.audio_service.embedding_service') as mock_embedding:
            
            # Setup mocks
            mock_model = MagicMock()
            mock_genai.GenerativeModel.return_value = mock_model
            
            # Mock STT response
            mock_response = AsyncMock()
            mock_response.text = "Hello world"
            mock_model.generate_content_async = AsyncMock(return_value=mock_response)
            
            # Mock Manager
            mock_manager.broadcast_to_admin = AsyncMock()
            
            # Mock Embedding
            mock_embedding.generate_embedding = AsyncMock(return_value=[0.1]*768)
            
            # Mock Pinecone
            mock_pinecone.query.return_value = [
                MagicMock(metadata={"text": "Regulatory context info"})
            ]
            
            # Init Service
            service = AudioService()
            service.PROCESS_THRESHOLD = 10 # Low threshold
            
            # Simulate Audio Chunk (base64)
            # 10 bytes of data
            import base64
            dummy_pcm = b'\x00' * 20
            b64_audio = base64.b64encode(dummy_pcm).decode('utf-8')
            
            meeting_id = "test-meeting"
            user_id = "test-user"
            
            # Act
            await service.process_audio_chunk(meeting_id, user_id, b64_audio)
            
            # Allow background tasks to run? 
            # process_audio_chunk uses asyncio.create_task.
            # We need to wait for it.
            await asyncio.sleep(0.1)
            
            # Assert
            # 1. Processing should have triggered
            # Check if generate_content_async was called (STT)
            mock_model.generate_content_async.assert_called()
            
            # 2. Transcription broadcast
            mock_manager.broadcast_to_admin.assert_any_call(
                meeting_id, 
                {
                    "type": "transcription",
                    "userId": user_id,
                    "text": "Hello world",
                    "timestamp": "now"
                }
            )
            
            # 3. AI Suggestion broadcast
            # "Hello world" > 10 chars? length is 11.
            # It should trigger suggestion.
            self.assertEqual(mock_manager.broadcast_to_admin.call_count, 2)
            args, _ = mock_manager.broadcast_to_admin.call_args
            self.assertEqual(args[0], meeting_id)
            self.assertEqual(args[1]["type"], "ai-suggestion")
            
            print("✅ AudioService Unit Test Passed")

if __name__ == "__main__":
    unittest.main()
