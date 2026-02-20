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
            service.stt_provider = "gemini"
            service.PROCESS_THRESHOLD = 10 # Low threshold
            service.AUTO_AI_ON_TRANSCRIPTION = True
            
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
            
            # 2. Transcription broadcast (allow extra latency metadata fields)
            transcription_payloads = [
                call_args[0][1]
                for call_args in mock_manager.broadcast_to_admin.call_args_list
                if call_args[0][0] == meeting_id and call_args[0][1].get("type") == "transcription"
            ]
            self.assertTrue(transcription_payloads, "Expected at least one transcription payload")
            latest_transcription = transcription_payloads[-1]
            self.assertEqual(latest_transcription.get("userId"), user_id)
            self.assertEqual(latest_transcription.get("text"), "Hello world")
            self.assertEqual(latest_transcription.get("timestamp"), "now")
            
            # 3. AI Suggestion broadcast
            # "Hello world" > 10 chars? length is 11.
            # It should trigger suggestion.
            self.assertEqual(mock_manager.broadcast_to_admin.call_count, 2)
            args, _ = mock_manager.broadcast_to_admin.call_args
            self.assertEqual(args[0], meeting_id)
            self.assertEqual(args[1]["type"], "ai-suggestion")
            
            print("✅ AudioService Unit Test Passed")

    async def test_generate_ai_suggestion_drops_stale_overlapping_request(self):
        with patch('app.services.meeting.audio_service.genai') as mock_genai, \
             patch('app.services.meeting.audio_service.manager') as mock_manager, \
             patch('app.services.meeting.audio_service.pinecone_service') as mock_pinecone, \
             patch('app.services.meeting.audio_service.embedding_service') as mock_embedding:

            mock_model = MagicMock()
            mock_genai.GenerativeModel.return_value = mock_model
            mock_model.generate_content_async = AsyncMock(
                return_value=MagicMock(text="Latest suggestion")
            )

            mock_manager.broadcast_to_admin = AsyncMock()
            mock_pinecone.query.return_value = [
                MagicMock(
                    score=0.92,
                    metadata={"text": "Verified policy context", "filename": "policy.pdf"},
                )
            ]

            async def embedding_side_effect(text):
                # Slow first request so the second becomes latest before generation.
                if text == "first request":
                    await asyncio.sleep(0.05)
                else:
                    await asyncio.sleep(0.001)
                return [0.1] * 768

            mock_embedding.generate_embedding = AsyncMock(side_effect=embedding_side_effect)

            service = AudioService()
            service.save_transcript_to_db = MagicMock()

            meeting_id = "m-overlap"
            user_id = "u-overlap"

            task_first = asyncio.create_task(
                service.generate_ai_suggestion(
                    meeting_id,
                    user_id,
                    "first request",
                    metadata={"requestId": "req-1", "requestedAtMs": 1000},
                )
            )
            await asyncio.sleep(0.01)
            task_second = asyncio.create_task(
                service.generate_ai_suggestion(
                    meeting_id,
                    user_id,
                    "second request",
                    metadata={"requestId": "req-2", "requestedAtMs": 2000},
                )
            )

            await asyncio.gather(task_first, task_second)

            ai_payloads = [
                call_args[0][1]
                for call_args in mock_manager.broadcast_to_admin.call_args_list
                if call_args[0][0] == meeting_id and call_args[0][1].get("type") == "ai-suggestion"
            ]
            self.assertEqual(len(ai_payloads), 1)
            self.assertEqual(ai_payloads[0].get("relatedTo"), "second request")
            self.assertEqual(ai_payloads[0].get("requestId"), "req-2")

    async def test_enqueue_ai_suggestion_cancels_previous_task(self):
        service = AudioService()
        cancelled_texts = []
        completed_texts = []

        async def fake_generate_ai_suggestion(meeting_id, user_id, text, metadata=None):
            try:
                if text == "first request":
                    await asyncio.sleep(0.05)
                else:
                    await asyncio.sleep(0.001)
                completed_texts.append(text)
            except asyncio.CancelledError:
                cancelled_texts.append(text)
                raise

        service.generate_ai_suggestion = fake_generate_ai_suggestion

        task_first = service.enqueue_ai_suggestion("meeting-1", "user-1", "first request")
        await asyncio.sleep(0.01)
        task_second = service.enqueue_ai_suggestion("meeting-1", "user-1", "second request")

        results = await asyncio.gather(task_first, task_second, return_exceptions=True)

        self.assertTrue(isinstance(results[0], asyncio.CancelledError))
        self.assertIsNone(results[1])
        self.assertIn("first request", cancelled_texts)
        self.assertEqual(completed_texts, ["second request"])
        self.assertEqual(service.ai_generation_tasks, {})

    async def test_enqueue_ai_suggestion_skips_recent_duplicate_text(self):
        service = AudioService()
        service.AI_MIN_REQUEST_INTERVAL_MS = 0
        service.AI_DUPLICATE_WINDOW_MS = 5000
        seen_texts = []

        async def fake_generate_ai_suggestion(meeting_id, user_id, text, metadata=None):
            seen_texts.append(text)
            await asyncio.sleep(0.001)

        service.generate_ai_suggestion = fake_generate_ai_suggestion

        first = service.enqueue_ai_suggestion("meeting-dup", "user-dup", "Hello customer")
        await asyncio.gather(first)

        duplicate = service.enqueue_ai_suggestion("meeting-dup", "user-dup", "  hello   customer  ")
        await asyncio.gather(duplicate)

        self.assertEqual(seen_texts, ["Hello customer"])
        self.assertEqual(service.ai_generation_tasks, {})

    async def test_enqueue_ai_suggestion_throttles_when_idle(self):
        service = AudioService()
        service.AI_MIN_REQUEST_INTERVAL_MS = 1000
        service.AI_DUPLICATE_WINDOW_MS = 0
        seen_texts = []

        async def fake_generate_ai_suggestion(meeting_id, user_id, text, metadata=None):
            seen_texts.append(text)
            await asyncio.sleep(0.001)

        service.generate_ai_suggestion = fake_generate_ai_suggestion

        first = service.enqueue_ai_suggestion("meeting-throttle", "user-throttle", "first")
        await asyncio.gather(first)

        second = service.enqueue_ai_suggestion("meeting-throttle", "user-throttle", "second")
        await asyncio.gather(second)

        # Simulate enough time passing for next request to be accepted.
        service.ai_recent_enqueues["meeting-throttle"]["user-throttle"]["arrivedAtMs"] -= 1500

        third = service.enqueue_ai_suggestion("meeting-throttle", "user-throttle", "third")
        await asyncio.gather(third)

        self.assertEqual(seen_texts, ["first", "third"])
        self.assertEqual(service.ai_generation_tasks, {})

    async def test_latency_snapshot_respects_window_and_percentiles(self):
        service = AudioService()
        service.LATENCY_METRICS_WINDOW = 3

        for value in [100, 200, 300, 400]:
            service._record_latency_metric("audioToTranscriptMs", value)

        service._record_ai_latency_metrics({
            "requestToAiLatencyMs": 250,
            "audioToAiLatencyMs": 550,
            "transcriptionToAiLatencyMs": 150,
        })

        snapshot = service.get_latency_snapshot()
        self.assertEqual(snapshot["windowSize"], 3)
        self.assertIn("generatedAtMs", snapshot)

        audio_to_transcript = snapshot["metrics"]["audioToTranscriptMs"]
        self.assertEqual(audio_to_transcript["count"], 3)
        self.assertEqual(audio_to_transcript["lastMs"], 400)
        self.assertEqual(audio_to_transcript["minMs"], 200)
        self.assertEqual(audio_to_transcript["maxMs"], 400)
        self.assertEqual(audio_to_transcript["p50Ms"], 300)
        self.assertEqual(audio_to_transcript["p95Ms"], 400)

        request_to_ai = snapshot["metrics"]["requestToAiMs"]
        self.assertEqual(request_to_ai["count"], 1)
        self.assertEqual(request_to_ai["lastMs"], 250)

        audio_to_ai = snapshot["metrics"]["audioToAiMs"]
        self.assertEqual(audio_to_ai["count"], 1)
        self.assertEqual(audio_to_ai["lastMs"], 550)

        transcription_to_ai = snapshot["metrics"]["transcriptionToAiMs"]
        self.assertEqual(transcription_to_ai["count"], 1)
        self.assertEqual(transcription_to_ai["lastMs"], 150)

    async def test_transcribe_audio_falls_back_to_gemini_when_deepgram_fails(self):
        service = AudioService()
        service.stt_provider = "deepgram"
        service.deepgram_api_key = "test-key"
        service._transcribe_with_deepgram = AsyncMock(side_effect=RuntimeError("deepgram down"))
        service._transcribe_with_gemini = AsyncMock(return_value="fallback transcript")

        transcript = await service._transcribe_audio(b"fake-wav")

        self.assertEqual(transcript, "fallback transcript")
        service._transcribe_with_deepgram.assert_awaited_once()
        service._transcribe_with_gemini.assert_awaited_once()

    async def test_deepgram_stream_emits_finalized_transcription(self):
        with patch('app.services.meeting.audio_service.manager') as mock_manager:
            mock_manager.broadcast_to_admin = AsyncMock()

            service = AudioService()
            service.AUTO_AI_ON_TRANSCRIPTION = False
            state = service._get_deepgram_stream_state("m-stream", "u-stream")
            state["currentAudioStartMs"] = 1000

            await service._handle_deepgram_stream_message(
                "m-stream",
                "u-stream",
                {
                    "type": "Results",
                    "is_final": True,
                    "speech_final": True,
                    "channel": {
                        "alternatives": [
                            {"transcript": "Hi there", "confidence": 0.92}
                        ]
                    },
                },
            )

            mock_manager.broadcast_to_admin.assert_awaited_once()
            args, _ = mock_manager.broadcast_to_admin.call_args
            payload = args[1]
            self.assertEqual(args[0], "m-stream")
            self.assertEqual(payload["type"], "transcription")
            self.assertEqual(payload["text"], "Hi there")
            self.assertEqual(payload["sttProvider"], "deepgram-stream")
            self.assertEqual(payload["clientAudioStartMs"], 1000)

    async def test_deepgram_stream_drops_low_confidence_result(self):
        with patch('app.services.meeting.audio_service.manager') as mock_manager:
            mock_manager.broadcast_to_admin = AsyncMock()

            service = AudioService()
            service.AUTO_AI_ON_TRANSCRIPTION = False
            service.deepgram_min_confidence = 0.6
            state = service._get_deepgram_stream_state("m-lowconf", "u-lowconf")
            state["currentAudioStartMs"] = 2000

            await service._handle_deepgram_stream_message(
                "m-lowconf",
                "u-lowconf",
                {
                    "type": "Results",
                    "is_final": True,
                    "speech_final": True,
                    "channel": {
                        "alternatives": [
                            {"transcript": "thank you", "confidence": 0.1}
                        ]
                    },
                },
            )

            mock_manager.broadcast_to_admin.assert_not_awaited()

    async def test_deepgram_stream_emits_on_is_final_without_speech_final(self):
        with patch('app.services.meeting.audio_service.manager') as mock_manager:
            mock_manager.broadcast_to_admin = AsyncMock()

            service = AudioService()
            service.AUTO_AI_ON_TRANSCRIPTION = False
            state = service._get_deepgram_stream_state("m-final", "u-final")
            state["currentAudioStartMs"] = 3000

            await service._handle_deepgram_stream_message(
                "m-final",
                "u-final",
                {
                    "type": "Results",
                    "is_final": True,
                    "speech_final": False,
                    "channel": {
                        "alternatives": [
                            {"transcript": "hello", "confidence": 0.95}
                        ]
                    },
                },
            )

            mock_manager.broadcast_to_admin.assert_awaited_once()
            args, _ = mock_manager.broadcast_to_admin.call_args
            payload = args[1]
            self.assertEqual(payload["type"], "transcription")
            self.assertEqual(payload["text"], "hello")
            self.assertEqual(payload["sttProvider"], "deepgram-stream")

    async def test_deepgram_phrase_allows_long_low_confidence_transcript(self):
        service = AudioService()
        service.deepgram_min_confidence = 0.45

        allowed = service._is_deepgram_phrase_valid(
            "I need help with my policy details",
            0.23,
        )
        blocked = service._is_deepgram_phrase_valid(
            "thank you",
            0.23,
        )

        self.assertTrue(allowed)
        self.assertFalse(blocked)

if __name__ == "__main__":
    unittest.main()
