import io
import wave
import base64
import asyncio
import os
import time
import json
import inspect
import google.generativeai as genai
import requests
import websockets
from urllib.parse import urlencode
from typing import Dict, Any, List, Optional
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
        # meeting_id -> { user_id -> sample_rate }
        self.sample_rates: Dict[str, Dict[str, int]] = {}
        # meeting_id -> { user_id -> client_audio_start_ms }
        self.buffer_client_start_ms: Dict[str, Dict[str, int]] = {}
        # meeting_id -> { user_id -> latest AI request metadata }
        self.latest_ai_requests: Dict[str, Dict[str, Dict[str, Any]]] = {}
        # meeting_id -> { user_id -> monotonically increasing request sequence }
        self.ai_request_seq: Dict[str, Dict[str, int]] = {}
        # meeting_id -> { user_id -> in-flight AI suggestion task }
        self.ai_generation_tasks: Dict[str, Dict[str, asyncio.Task]] = {}
        # meeting_id -> { user_id -> recent enqueue metadata }
        self.ai_recent_enqueues: Dict[str, Dict[str, Dict[str, Any]]] = {}
        
        self.ai_model_name = os.getenv("MEETING_AI_MODEL", "gemini-2.5-flash")
        self.deepgram_api_key = os.getenv("DEEPGRAM_API_KEY", "").strip()
        requested_stt_provider = os.getenv("MEETING_STT_PROVIDER", "").strip().lower()
        if requested_stt_provider in {"deepgram", "gemini"}:
            self.stt_provider = requested_stt_provider
        else:
            self.stt_provider = "deepgram" if self.deepgram_api_key else "gemini"
        self.deepgram_model = os.getenv("MEETING_DEEPGRAM_MODEL", "nova-3")
        self.deepgram_language = os.getenv("MEETING_DEEPGRAM_LANGUAGE", "en-US")
        self.deepgram_url = os.getenv("MEETING_DEEPGRAM_URL", "https://api.deepgram.com/v1/listen")
        self.deepgram_stream_url = os.getenv(
            "MEETING_DEEPGRAM_STREAM_URL",
            "wss://api.deepgram.com/v1/listen",
        )
        deepgram_connect_params = inspect.signature(websockets.connect).parameters
        if "additional_headers" in deepgram_connect_params:
            self.deepgram_ws_headers_arg = "additional_headers"
        else:
            self.deepgram_ws_headers_arg = "extra_headers"
        self.deepgram_timeout_sec = self._read_non_negative_int_env("MEETING_DEEPGRAM_TIMEOUT_SEC", 12)
        self.deepgram_streaming_enabled = (
            os.getenv("MEETING_DEEPGRAM_STREAMING", "true").lower()
            in {"1", "true", "yes", "on"}
        )
        self.deepgram_interim_results = (
            os.getenv("MEETING_DEEPGRAM_INTERIM_RESULTS", "true").lower()
            in {"1", "true", "yes", "on"}
        )
        self.deepgram_keepalive_sec = self._read_non_negative_int_env(
            "MEETING_DEEPGRAM_KEEPALIVE_SEC",
            4,
        )
        self.deepgram_endpointing_ms = self._read_non_negative_int_env(
            "MEETING_DEEPGRAM_ENDPOINTING_MS",
            300,
        )
        self.deepgram_utterance_end_ms = self._read_non_negative_int_env(
            "MEETING_DEEPGRAM_UTTERANCE_END_MS",
            1000,
        )
        self.deepgram_emit_dedup_window_ms = self._read_non_negative_int_env(
            "MEETING_DEEPGRAM_EMIT_DEDUP_WINDOW_MS",
            1800,
        )
        self.deepgram_min_confidence = self._read_non_negative_float_env(
            "MEETING_DEEPGRAM_MIN_CONFIDENCE",
            0.45,
        )
        self.deepgram_min_chars = self._read_non_negative_int_env(
            "MEETING_DEEPGRAM_MIN_CHARS",
            2,
        )
        self.deepgram_draft_emit_interval_ms = self._read_non_negative_int_env(
            "MEETING_DEEPGRAM_DRAFT_EMIT_INTERVAL_MS",
            280,
        )
        self.deepgram_draft_min_chars = self._read_non_negative_int_env(
            "MEETING_DEEPGRAM_DRAFT_MIN_CHARS",
            4,
        )
        ignored_phrases_env = os.getenv("MEETING_DEEPGRAM_IGNORE_PHRASES", "").strip()
        self.deepgram_ignored_phrases = {
            self._normalize_request_text(phrase)
            for phrase in ignored_phrases_env.split(",")
            if phrase.strip()
        }
        keyterms_env = os.getenv("MEETING_DEEPGRAM_KEYTERMS", "").strip()
        if keyterms_env:
            self.deepgram_keyterms = [term.strip() for term in keyterms_env.split(",") if term.strip()]
        else:
            self.deepgram_keyterms = [
                "medicare",
                "supplement",
                "advantage",
                "deductible",
                "premium",
                "copay",
                "coinsurance",
                "prescription",
                "network",
                "enrollment",
            ]
        self.AUTO_AI_ON_TRANSCRIPTION = (
            os.getenv("MEETING_AUTO_AI_ON_TRANSCRIPTION", "false").lower()
            in {"1", "true", "yes", "on"}
        )
        self.AI_MIN_REQUEST_INTERVAL_MS = self._read_non_negative_int_env(
            "MEETING_AI_MIN_REQUEST_INTERVAL_MS",
            400,
        )
        self.AI_DUPLICATE_WINDOW_MS = self._read_non_negative_int_env(
            "MEETING_AI_DUPLICATE_WINDOW_MS",
            3000,
        )
        self.LATENCY_METRICS_WINDOW = self._read_non_negative_int_env(
            "MEETING_LATENCY_METRICS_WINDOW",
            200,
        )
        self.latency_metrics: Dict[str, List[int]] = {
            "audioToTranscriptMs": [],
            "requestToAiMs": [],
            "audioToAiMs": [],
            "transcriptionToAiMs": [],
        }
        # meeting_id -> { user_id -> deepgram streaming state }
        self.deepgram_streams: Dict[str, Dict[str, Dict[str, Any]]] = {}
        
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

    def _set_processing(self, meeting_id: str, user_id: str, value: bool):
        if meeting_id not in self.is_processing:
            self.is_processing[meeting_id] = {}
        self.is_processing[meeting_id][user_id] = value

    def _get_sample_rate(self, meeting_id: str, user_id: str) -> int:
        return self.sample_rates.get(meeting_id, {}).get(user_id, self.SAMPLE_RATE)

    def _set_sample_rate(self, meeting_id: str, user_id: str, sample_rate: Optional[int]):
        if sample_rate is None:
            return
        if not isinstance(sample_rate, int):
            return
        if sample_rate < 8000 or sample_rate > 96000:
            return
        if meeting_id not in self.sample_rates:
            self.sample_rates[meeting_id] = {}
        self.sample_rates[meeting_id][user_id] = sample_rate

    def _coerce_positive_int(self, value: Any) -> Optional[int]:
        try:
            parsed = int(value)
        except (TypeError, ValueError):
            return None
        return parsed if parsed > 0 else None

    def _read_non_negative_int_env(self, key: str, default: int) -> int:
        raw_value = os.getenv(key)
        if raw_value is None:
            return default
        try:
            parsed = int(raw_value)
        except (TypeError, ValueError):
            return default
        return parsed if parsed >= 0 else default

    def _read_non_negative_float_env(self, key: str, default: float) -> float:
        raw_value = os.getenv(key)
        if raw_value is None:
            return default
        try:
            parsed = float(raw_value)
        except (TypeError, ValueError):
            return default
        return parsed if parsed >= 0 else default

    def _normalize_request_text(self, text: str) -> str:
        return " ".join(text.strip().lower().split())

    def _create_noop_task(self) -> asyncio.Task:
        async def _noop():
            return None

        return asyncio.create_task(_noop())

    def _should_use_deepgram_streaming(self) -> bool:
        return (
            self.stt_provider == "deepgram"
            and bool(self.deepgram_api_key)
            and self.deepgram_streaming_enabled
        )

    def _get_deepgram_stream_state(self, meeting_id: str, user_id: str) -> Dict[str, Any]:
        meeting_streams = self.deepgram_streams.setdefault(meeting_id, {})
        state = meeting_streams.get(user_id)
        if state is None:
            state = {
                "ws": None,
                "receiverTask": None,
                "keepAliveTask": None,
                "lock": asyncio.Lock(),
                "sampleRate": self.SAMPLE_RATE,
                "finalSegments": [],
                "lastFinalSegmentNorm": "",
                "lastEmittedNorm": "",
                "lastEmittedAtMs": 0,
                "currentAudioStartMs": None,
                "lastAudioAtMs": 0,
                "turnCounter": 0,
                "currentTurnId": "",
                "lastDraftNorm": "",
                "lastDraftAtMs": 0,
            }
            meeting_streams[user_id] = state
        return state

    def _next_turn_id(self, state: Dict[str, Any]) -> str:
        current_turn = state.get("currentTurnId")
        if current_turn:
            return str(current_turn)

        next_counter = int(state.get("turnCounter", 0)) + 1
        state["turnCounter"] = next_counter
        generated_turn_id = f"turn-{next_counter}"
        state["currentTurnId"] = generated_turn_id
        return generated_turn_id

    def _build_deepgram_stream_url(self, sample_rate: int) -> str:
        params: List[tuple[str, str]] = [
            ("model", self.deepgram_model),
            ("language", self.deepgram_language),
            ("encoding", "linear16"),
            ("channels", str(self.CHANNELS)),
            ("sample_rate", str(sample_rate)),
            ("punctuate", "true"),
            ("smart_format", "true"),
            ("interim_results", "true" if self.deepgram_interim_results else "false"),
            ("vad_events", "true"),
        ]

        if self.deepgram_endpointing_ms > 0:
            params.append(("endpointing", str(self.deepgram_endpointing_ms)))
        else:
            params.append(("endpointing", "false"))

        if self.deepgram_utterance_end_ms > 0:
            params.append(("utterance_end_ms", str(self.deepgram_utterance_end_ms)))

        for keyterm in self.deepgram_keyterms:
            params.append(("keyterm", keyterm))

        return f"{self.deepgram_stream_url}?{urlencode(params, doseq=True)}"

    def _is_deepgram_phrase_valid(self, transcript: str, confidence: Optional[float]) -> bool:
        text = transcript.strip()
        if len(text) < self.deepgram_min_chars:
            return False

        normalized = self._normalize_request_text(text)
        if not normalized:
            return False

        if normalized in self.deepgram_ignored_phrases:
            return False

        if confidence is None:
            return True

        try:
            parsed_confidence = float(confidence)
        except (TypeError, ValueError):
            return True

        if parsed_confidence >= self.deepgram_min_confidence:
            return True

        # Avoid dropping valid longer sentences that often score lower in noisy meetings.
        words = normalized.split()
        if len(words) >= 3 and len(normalized) >= 12 and parsed_confidence >= 0.2:
            return True

        return False

    def _is_deepgram_draft_valid(self, transcript: str) -> bool:
        text = transcript.strip()
        if len(text) < self.deepgram_draft_min_chars:
            return False
        normalized = self._normalize_request_text(text)
        if not normalized:
            return False
        if normalized in self.deepgram_ignored_phrases:
            return False
        return True

    async def _update_stream_audio_start(
        self,
        meeting_id: str,
        user_id: str,
        client_sent_at_ms: Optional[int],
    ):
        parsed = self._coerce_positive_int(client_sent_at_ms)
        if parsed is None:
            return

        state = self._get_deepgram_stream_state(meeting_id, user_id)
        async with state["lock"]:
            existing = self._coerce_positive_int(state.get("currentAudioStartMs"))
            if existing is None or parsed < existing:
                state["currentAudioStartMs"] = parsed

    async def _append_deepgram_final_segment(self, meeting_id: str, user_id: str, transcript: str):
        text = transcript.strip()
        if not text:
            return

        normalized = self._normalize_request_text(text)
        if not normalized:
            return

        state = self._get_deepgram_stream_state(meeting_id, user_id)
        async with state["lock"]:
            if normalized == state.get("lastFinalSegmentNorm"):
                return
            state["lastFinalSegmentNorm"] = normalized
            state.setdefault("finalSegments", []).append(text)

    async def _emit_deepgram_draft_transcript(self, meeting_id: str, user_id: str, transcript: str):
        text = (transcript or "").strip()
        if not self._is_deepgram_draft_valid(text):
            return

        turn_id = ""
        client_audio_start_ms: Optional[int] = None
        now_ms = int(time.time() * 1000)

        state = self.deepgram_streams.get(meeting_id, {}).get(user_id)
        if not state:
            return

        normalized = self._normalize_request_text(text)

        async with state["lock"]:
            last_draft_norm = state.get("lastDraftNorm") or ""
            last_draft_at_ms = self._coerce_positive_int(state.get("lastDraftAtMs")) or 0

            if normalized == last_draft_norm:
                return
            if (
                last_draft_at_ms
                and (now_ms - last_draft_at_ms) < self.deepgram_draft_emit_interval_ms
                and len(normalized) <= len(last_draft_norm)
            ):
                return

            state["lastDraftNorm"] = normalized
            state["lastDraftAtMs"] = now_ms
            turn_id = self._next_turn_id(state)
            client_audio_start_ms = self._coerce_positive_int(state.get("currentAudioStartMs"))

        await self._handle_transcription_result(
            meeting_id,
            user_id,
            text,
            client_audio_start_ms=client_audio_start_ms,
            provider="deepgram-stream",
            transcript_stage="draft",
            turn_id=turn_id,
        )

    async def _emit_deepgram_utterance(self, meeting_id: str, user_id: str):
        state = self.deepgram_streams.get(meeting_id, {}).get(user_id)
        if not state:
            return

        text = ""
        client_audio_start_ms: Optional[int] = None
        should_emit = False
        normalized = ""
        now_ms = int(time.time() * 1000)
        turn_id = ""

        async with state["lock"]:
            segments = state.get("finalSegments", [])
            if not segments:
                state["currentAudioStartMs"] = None
                state["lastFinalSegmentNorm"] = ""
                return

            text = " ".join(segments).strip()
            normalized = self._normalize_request_text(text)
            turn_id = self._next_turn_id(state)
            last_emitted_norm = state.get("lastEmittedNorm")
            last_emitted_at_ms = self._coerce_positive_int(state.get("lastEmittedAtMs")) or 0
            dedup_window_active = (
                normalized
                and normalized == last_emitted_norm
                and (now_ms - last_emitted_at_ms) < self.deepgram_emit_dedup_window_ms
            )

            state["finalSegments"] = []
            state["lastFinalSegmentNorm"] = ""
            client_audio_start_ms = self._coerce_positive_int(state.get("currentAudioStartMs"))
            state["currentAudioStartMs"] = None

            if not normalized or dedup_window_active:
                state["currentTurnId"] = ""
                state["lastDraftNorm"] = ""
                state["lastDraftAtMs"] = 0
                return

            state["lastEmittedNorm"] = normalized
            state["lastEmittedAtMs"] = now_ms
            state["currentTurnId"] = ""
            state["lastDraftNorm"] = ""
            state["lastDraftAtMs"] = 0
            should_emit = True

        if should_emit:
            await self._handle_transcription_result(
                meeting_id,
                user_id,
                text,
                client_audio_start_ms=client_audio_start_ms,
                provider="deepgram-stream",
                transcript_stage="final",
                turn_id=turn_id,
            )

    async def _handle_deepgram_stream_message(
        self,
        meeting_id: str,
        user_id: str,
        payload: Dict[str, Any],
    ):
        message_type = str(payload.get("type", "")).lower()
        if message_type == "results":
            channel = payload.get("channel", {})
            alternatives = channel.get("alternatives") or []
            best_alternative = alternatives[0] if alternatives else {}
            transcript = (best_alternative.get("transcript") or "").strip()
            confidence = best_alternative.get("confidence")
            is_final = bool(payload.get("is_final"))
            speech_final = bool(payload.get("speech_final"))

            if transcript and not is_final:
                await self._emit_deepgram_draft_transcript(meeting_id, user_id, transcript)

            if is_final and transcript and self._is_deepgram_phrase_valid(transcript, confidence):
                await self._append_deepgram_final_segment(meeting_id, user_id, transcript)
                # Emit immediately on finalized chunks to avoid losing text when
                # speech_final/utteranceend events don't arrive before a timeout.
                if not speech_final:
                    await self._emit_deepgram_utterance(meeting_id, user_id)

            if speech_final:
                await self._emit_deepgram_utterance(meeting_id, user_id)
            return

        if message_type == "utteranceend":
            await self._emit_deepgram_utterance(meeting_id, user_id)

    async def _deepgram_keepalive_loop(
        self,
        meeting_id: str,
        user_id: str,
        ws,
    ):
        if self.deepgram_keepalive_sec <= 0:
            return

        try:
            while True:
                await asyncio.sleep(self.deepgram_keepalive_sec)
                state = self.deepgram_streams.get(meeting_id, {}).get(user_id)
                if not state or state.get("ws") is not ws:
                    return
                await ws.send(json.dumps({"type": "KeepAlive"}))
        except asyncio.CancelledError:
            raise
        except Exception as error:
            print(f"Deepgram keepalive error for {meeting_id}/{user_id}: {error}")

    async def _deepgram_receiver_loop(
        self,
        meeting_id: str,
        user_id: str,
        ws,
    ):
        try:
            async for message in ws:
                if isinstance(message, bytes):
                    continue
                try:
                    payload = json.loads(message)
                except json.JSONDecodeError:
                    continue
                if isinstance(payload, dict):
                    await self._handle_deepgram_stream_message(meeting_id, user_id, payload)
        except asyncio.CancelledError:
            raise
        except Exception as error:
            print(f"Deepgram stream receiver error for {meeting_id}/{user_id}: {error}")
        finally:
            state = self.deepgram_streams.get(meeting_id, {}).get(user_id)
            if state:
                if state.get("ws") is ws:
                    state["ws"] = None
                if state.get("receiverTask") is asyncio.current_task():
                    state["receiverTask"] = None

    async def _close_deepgram_stream_locked(
        self,
        meeting_id: str,
        user_id: str,
        state: Dict[str, Any],
        flush: bool = False,
    ):
        ws = state.get("ws")
        receiver_task = state.get("receiverTask")
        keepalive_task = state.get("keepAliveTask")

        if flush and ws is not None:
            try:
                await ws.send(json.dumps({"type": "Finalize"}))
                await asyncio.sleep(0.15)
            except Exception:
                pass

        if receiver_task and receiver_task is not asyncio.current_task():
            receiver_task.cancel()
            try:
                await receiver_task
            except asyncio.CancelledError:
                pass
            except Exception:
                pass

        if keepalive_task and keepalive_task is not asyncio.current_task():
            keepalive_task.cancel()
            try:
                await keepalive_task
            except asyncio.CancelledError:
                pass
            except Exception:
                pass

        if ws is not None:
            try:
                await ws.close()
            except Exception:
                pass

        state["ws"] = None
        state["receiverTask"] = None
        state["keepAliveTask"] = None
        state["finalSegments"] = []
        state["lastFinalSegmentNorm"] = ""
        state["currentAudioStartMs"] = None
        state["lastAudioAtMs"] = 0
        state["currentTurnId"] = ""
        state["lastDraftNorm"] = ""
        state["lastDraftAtMs"] = 0

    async def _close_deepgram_stream(self, meeting_id: str, user_id: str, flush: bool = False):
        meeting_streams = self.deepgram_streams.get(meeting_id)
        if not meeting_streams:
            return

        state = meeting_streams.get(user_id)
        if not state:
            return

        async with state["lock"]:
            await self._close_deepgram_stream_locked(
                meeting_id,
                user_id,
                state,
                flush=flush,
            )

        meeting_streams.pop(user_id, None)
        if not meeting_streams:
            self.deepgram_streams.pop(meeting_id, None)

    async def _ensure_deepgram_stream(self, meeting_id: str, user_id: str, sample_rate: int) -> Dict[str, Any]:
        state = self._get_deepgram_stream_state(meeting_id, user_id)
        async with state["lock"]:
            ws = state.get("ws")
            receiver_task = state.get("receiverTask")
            needs_fresh_connection = (
                ws is None
                or getattr(ws, "closed", False)
                or receiver_task is None
                or receiver_task.done()
                or state.get("sampleRate") != sample_rate
            )

            if needs_fresh_connection:
                await self._close_deepgram_stream_locked(meeting_id, user_id, state, flush=False)
                stream_url = self._build_deepgram_stream_url(sample_rate)
                connect_kwargs: Dict[str, Any] = {
                    self.deepgram_ws_headers_arg: {"Authorization": f"Token {self.deepgram_api_key}"},
                    "ping_interval": 20,
                    "ping_timeout": 20,
                    "close_timeout": 2,
                    "max_size": 2**22,
                }
                state["ws"] = await websockets.connect(
                    stream_url,
                    **connect_kwargs,
                )
                state["sampleRate"] = sample_rate
                state["receiverTask"] = asyncio.create_task(
                    self._deepgram_receiver_loop(
                        meeting_id,
                        user_id,
                        state["ws"],
                    )
                )
                state["keepAliveTask"] = asyncio.create_task(
                    self._deepgram_keepalive_loop(
                        meeting_id,
                        user_id,
                        state["ws"],
                    )
                )
        return state

    async def _send_audio_to_deepgram_stream(
        self,
        meeting_id: str,
        user_id: str,
        audio_bytes: bytes,
        sample_rate: Optional[int],
        client_sent_at_ms: Optional[int],
    ):
        effective_sample_rate = sample_rate if sample_rate else self.SAMPLE_RATE
        state = await self._ensure_deepgram_stream(meeting_id, user_id, effective_sample_rate)
        await self._update_stream_audio_start(meeting_id, user_id, client_sent_at_ms)
        state["lastAudioAtMs"] = int(time.time() * 1000)

        try:
            await state["ws"].send(audio_bytes)
        except Exception:
            await self._close_deepgram_stream(meeting_id, user_id, flush=False)
            state = await self._ensure_deepgram_stream(meeting_id, user_id, effective_sample_rate)
            state["lastAudioAtMs"] = int(time.time() * 1000)
            await state["ws"].send(audio_bytes)

    def _schedule_close_deepgram_stream(self, meeting_id: str, user_id: str, flush: bool):
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            return
        loop.create_task(self._close_deepgram_stream(meeting_id, user_id, flush=flush))

    async def _handle_transcription_result(
        self,
        meeting_id: str,
        user_id: str,
        text: str,
        client_audio_start_ms: Optional[int] = None,
        provider: Optional[str] = None,
        transcript_stage: str = "final",
        turn_id: Optional[str] = None,
    ):
        clean_text = (text or "").strip()
        if not clean_text:
            return

        print(f"Transcription: {clean_text}")
        transcribed_at_ms = int(time.time() * 1000)
        transcription_latency_ms = (
            transcribed_at_ms - client_audio_start_ms
            if client_audio_start_ms
            else None
        )
        self._record_latency_metric("audioToTranscriptMs", transcription_latency_ms)

        await manager.broadcast_to_admin(meeting_id, {
            "type": "transcription",
            "userId": user_id,
            "text": clean_text,
            "timestamp": "now",
            "clientAudioStartMs": client_audio_start_ms,
            "transcribedAtMs": transcribed_at_ms,
            "transcriptionLatencyMs": transcription_latency_ms,
            "sttProvider": provider or self.stt_provider,
            "transcriptStage": transcript_stage,
            "isFinal": transcript_stage == "final",
            "turnId": turn_id,
        })

        if (
            transcript_stage == "final"
            and self.AUTO_AI_ON_TRANSCRIPTION
            and len(clean_text) > 10
        ):
            self.enqueue_ai_suggestion(
                meeting_id,
                user_id,
                clean_text,
                metadata={
                    "requestOrigin": "auto-transcription",
                    "transcriptStage": "final",
                    "turnId": turn_id,
                    "requestedAtMs": transcribed_at_ms,
                    "sourceAudioStartMs": client_audio_start_ms,
                    "sourceTranscriptionAtMs": transcribed_at_ms,
                },
            )

    async def _transcribe_with_gemini(self, wav_data: bytes) -> str:
        model = genai.GenerativeModel(self.ai_model_name)
        response = await model.generate_content_async([
            {
                "mime_type": "audio/wav",
                "data": wav_data
            },
            "Transcribe this audio exactly. Return ONLY the spoken words. If silence, return empty string."
        ])
        return (response.text or "").strip()

    def _transcribe_with_deepgram_sync(self, wav_data: bytes) -> str:
        if not self.deepgram_api_key:
            raise RuntimeError("Missing DEEPGRAM_API_KEY")

        params: List[tuple[str, Any]] = [
            ("model", self.deepgram_model),
            ("language", self.deepgram_language),
            ("smart_format", "true"),
            ("punctuate", "true"),
        ]
        for keyterm in self.deepgram_keyterms:
            params.append(("keyterm", keyterm))

        response = requests.post(
            self.deepgram_url,
            params=params,
            headers={
                "Authorization": f"Token {self.deepgram_api_key}",
                "Content-Type": "audio/wav",
            },
            data=wav_data,
            timeout=self.deepgram_timeout_sec,
        )
        response.raise_for_status()
        payload = response.json()
        return (
            payload.get("results", {})
            .get("channels", [{}])[0]
            .get("alternatives", [{}])[0]
            .get("transcript", "")
            .strip()
        )

    async def _transcribe_with_deepgram(self, wav_data: bytes) -> str:
        return await asyncio.to_thread(self._transcribe_with_deepgram_sync, wav_data)

    async def _transcribe_audio(self, wav_data: bytes) -> str:
        provider = self.stt_provider

        if provider == "deepgram":
            try:
                return await self._transcribe_with_deepgram(wav_data)
            except Exception as e:
                print(f"Deepgram transcription error, falling back to Gemini: {e}")
                return await self._transcribe_with_gemini(wav_data)

        return await self._transcribe_with_gemini(wav_data)

    def _record_latency_metric(self, metric_key: str, value_ms: Any):
        if self.LATENCY_METRICS_WINDOW <= 0:
            return
        value = self._coerce_positive_int(value_ms)
        if value is None:
            return
        bucket = self.latency_metrics.setdefault(metric_key, [])
        bucket.append(value)
        overflow = len(bucket) - self.LATENCY_METRICS_WINDOW
        if overflow > 0:
            del bucket[:overflow]

    def _percentile(self, values: List[int], percentile: int) -> Optional[int]:
        if not values:
            return None
        sorted_values = sorted(values)
        index = max(0, min(len(sorted_values) - 1, (percentile * len(sorted_values) + 99) // 100 - 1))
        return sorted_values[index]

    def _latency_summary(self, values: List[int]) -> Dict[str, Optional[int]]:
        if not values:
            return {
                "count": 0,
                "lastMs": None,
                "minMs": None,
                "maxMs": None,
                "p50Ms": None,
                "p95Ms": None,
            }

        return {
            "count": len(values),
            "lastMs": values[-1],
            "minMs": min(values),
            "maxMs": max(values),
            "p50Ms": self._percentile(values, 50),
            "p95Ms": self._percentile(values, 95),
        }

    def _record_ai_latency_metrics(self, latency_fields: Dict[str, Any]):
        self._record_latency_metric("requestToAiMs", latency_fields.get("requestToAiLatencyMs"))
        self._record_latency_metric("audioToAiMs", latency_fields.get("audioToAiLatencyMs"))
        self._record_latency_metric("transcriptionToAiMs", latency_fields.get("transcriptionToAiLatencyMs"))

    def get_latency_snapshot(self) -> Dict[str, Any]:
        return {
            "windowSize": self.LATENCY_METRICS_WINDOW,
            "generatedAtMs": int(time.time() * 1000),
            "metrics": {
                key: self._latency_summary(values)
                for key, values in self.latency_metrics.items()
            },
        }

    def _set_buffer_client_start(self, meeting_id: str, user_id: str, client_sent_at_ms: Optional[int]):
        parsed = self._coerce_positive_int(client_sent_at_ms)
        if parsed is None:
            return
        if meeting_id not in self.buffer_client_start_ms:
            self.buffer_client_start_ms[meeting_id] = {}
        existing = self.buffer_client_start_ms[meeting_id].get(user_id)
        if existing is None or parsed < existing:
            self.buffer_client_start_ms[meeting_id][user_id] = parsed

    def _pop_buffer_client_start(self, meeting_id: str, user_id: str) -> Optional[int]:
        if meeting_id not in self.buffer_client_start_ms:
            return None
        value = self.buffer_client_start_ms[meeting_id].pop(user_id, None)
        if not self.buffer_client_start_ms[meeting_id]:
            del self.buffer_client_start_ms[meeting_id]
        return value

    def _build_ai_latency_fields(self, metadata: Optional[Dict[str, Any]]) -> Dict[str, Any]:
        safe_metadata = metadata if isinstance(metadata, dict) else {}
        request_id = safe_metadata.get("requestId")
        request_origin = safe_metadata.get("requestOrigin") or "manual"
        transcript_stage = safe_metadata.get("transcriptStage")
        turn_id = safe_metadata.get("turnId")
        requested_at_ms = self._coerce_positive_int(safe_metadata.get("requestedAtMs"))
        source_audio_start_ms = self._coerce_positive_int(safe_metadata.get("sourceAudioStartMs"))
        source_transcription_at_ms = self._coerce_positive_int(safe_metadata.get("sourceTranscriptionAtMs"))
        ai_generated_at_ms = int(time.time() * 1000)

        return {
            "requestId": request_id,
            "requestOrigin": request_origin,
            "transcriptStage": transcript_stage,
            "turnId": turn_id,
            "requestedAtMs": requested_at_ms,
            "sourceAudioStartMs": source_audio_start_ms,
            "sourceTranscriptionAtMs": source_transcription_at_ms,
            "aiGeneratedAtMs": ai_generated_at_ms,
            "requestToAiLatencyMs": (ai_generated_at_ms - requested_at_ms) if requested_at_ms else None,
            "audioToAiLatencyMs": (ai_generated_at_ms - source_audio_start_ms) if source_audio_start_ms else None,
            "transcriptionToAiLatencyMs": (ai_generated_at_ms - source_transcription_at_ms) if source_transcription_at_ms else None,
        }

    def _register_ai_request(
        self,
        meeting_id: str,
        user_id: str,
        metadata: Optional[Dict[str, Any]],
    ) -> Dict[str, Any]:
        safe_metadata = dict(metadata) if isinstance(metadata, dict) else {}
        requested_at_ms = self._coerce_positive_int(safe_metadata.get("requestedAtMs")) or int(time.time() * 1000)
        request_id = safe_metadata.get("requestId")
        if not request_id:
            request_id = f"ai-{requested_at_ms}-{int(time.time() * 1000) % 1000000}"

        if meeting_id not in self.ai_request_seq:
            self.ai_request_seq[meeting_id] = {}
        next_seq = self.ai_request_seq[meeting_id].get(user_id, 0) + 1
        self.ai_request_seq[meeting_id][user_id] = next_seq

        if meeting_id not in self.latest_ai_requests:
            self.latest_ai_requests[meeting_id] = {}
        self.latest_ai_requests[meeting_id][user_id] = {
            "requestId": request_id,
            "requestedAtMs": requested_at_ms,
            "sequence": next_seq,
        }

        safe_metadata["requestId"] = request_id
        safe_metadata["requestedAtMs"] = requested_at_ms
        if not safe_metadata.get("requestOrigin"):
            safe_metadata["requestOrigin"] = "manual"

        return {
            "sequence": next_seq,
            "metadata": safe_metadata,
        }

    def _is_latest_ai_request(self, meeting_id: str, user_id: str, sequence: int) -> bool:
        latest = self.latest_ai_requests.get(meeting_id, {}).get(user_id)
        return bool(latest) and latest.get("sequence") == sequence

    def enqueue_ai_suggestion(
        self,
        meeting_id: str,
        user_id: str,
        text: str,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> asyncio.Task:
        normalized_text = self._normalize_request_text(text)
        now_ms = int(time.time() * 1000)
        meeting_tasks = self.ai_generation_tasks.get(meeting_id)
        meeting_recent = self.ai_recent_enqueues.setdefault(meeting_id, {})
        recent = meeting_recent.get(user_id)
        existing_task = meeting_tasks.get(user_id) if meeting_tasks else None

        elapsed_ms = (
            max(0, now_ms - int(recent.get("arrivedAtMs", 0)))
            if recent and recent.get("arrivedAtMs") is not None
            else None
        )

        if (
            recent
            and normalized_text
            and recent.get("normalizedText") == normalized_text
            and elapsed_ms is not None
            and elapsed_ms < self.AI_DUPLICATE_WINDOW_MS
        ):
            print(f"Skipping duplicate AI request for {meeting_id}/{user_id}")
            if existing_task and not existing_task.done():
                return existing_task
            return self._create_noop_task()

        if (
            recent
            and (not existing_task or existing_task.done())
            and elapsed_ms is not None
            and elapsed_ms < self.AI_MIN_REQUEST_INTERVAL_MS
        ):
            print(f"Throttling AI request for {meeting_id}/{user_id}")
            return self._create_noop_task()

        meeting_recent[user_id] = {
            "arrivedAtMs": now_ms,
            "normalizedText": normalized_text,
        }

        if meeting_tasks is None:
            meeting_tasks = {}
            self.ai_generation_tasks[meeting_id] = meeting_tasks

        if existing_task and not existing_task.done():
            existing_task.cancel()

        task = asyncio.create_task(
            self.generate_ai_suggestion(
                meeting_id,
                user_id,
                text,
                metadata=metadata,
            )
        )
        meeting_tasks[user_id] = task

        def _cleanup(done_task: asyncio.Task):
            current = self.ai_generation_tasks.get(meeting_id, {}).get(user_id)
            if current is done_task:
                self.ai_generation_tasks[meeting_id].pop(user_id, None)
                if not self.ai_generation_tasks[meeting_id]:
                    del self.ai_generation_tasks[meeting_id]
            try:
                done_task.result()
            except asyncio.CancelledError:
                pass
            except Exception as task_error:
                print(f"AI suggestion task error: {task_error}")

        task.add_done_callback(_cleanup)
        return task

    def _schedule_if_ready(self, meeting_id: str, user_id: str):
        buffer_obj = self._get_buffer(meeting_id, user_id)
        is_busy = self.is_processing.get(meeting_id, {}).get(user_id, False)
        if is_busy:
            return
        if len(buffer_obj) < self.PROCESS_THRESHOLD:
            return

        audio_to_process = bytes(buffer_obj)
        client_audio_start_ms = self._pop_buffer_client_start(meeting_id, user_id)
        self._clear_buffer(meeting_id, user_id)
        self._set_processing(meeting_id, user_id, True)
        asyncio.create_task(
            self.handle_transcription(
                meeting_id,
                user_id,
                audio_to_process,
                client_audio_start_ms=client_audio_start_ms,
            )
        )

    def clear_user_state(self, meeting_id: str, user_id: str):
        self._schedule_close_deepgram_stream(meeting_id, user_id, flush=True)
        if meeting_id in self.buffers:
            self.buffers[meeting_id].pop(user_id, None)
            if not self.buffers[meeting_id]:
                del self.buffers[meeting_id]
        if meeting_id in self.is_processing:
            self.is_processing[meeting_id].pop(user_id, None)
            if not self.is_processing[meeting_id]:
                del self.is_processing[meeting_id]
        if meeting_id in self.sample_rates:
            self.sample_rates[meeting_id].pop(user_id, None)
            if not self.sample_rates[meeting_id]:
                del self.sample_rates[meeting_id]
        if meeting_id in self.buffer_client_start_ms:
            self.buffer_client_start_ms[meeting_id].pop(user_id, None)
            if not self.buffer_client_start_ms[meeting_id]:
                del self.buffer_client_start_ms[meeting_id]
        if meeting_id in self.latest_ai_requests:
            self.latest_ai_requests[meeting_id].pop(user_id, None)
            if not self.latest_ai_requests[meeting_id]:
                del self.latest_ai_requests[meeting_id]
        if meeting_id in self.ai_request_seq:
            self.ai_request_seq[meeting_id].pop(user_id, None)
            if not self.ai_request_seq[meeting_id]:
                del self.ai_request_seq[meeting_id]
        if meeting_id in self.ai_generation_tasks:
            active_task = self.ai_generation_tasks[meeting_id].pop(user_id, None)
            if active_task and not active_task.done():
                active_task.cancel()
            if not self.ai_generation_tasks[meeting_id]:
                del self.ai_generation_tasks[meeting_id]
        if meeting_id in self.ai_recent_enqueues:
            self.ai_recent_enqueues[meeting_id].pop(user_id, None)
            if not self.ai_recent_enqueues[meeting_id]:
                del self.ai_recent_enqueues[meeting_id]

    async def process_audio_chunk(
        self,
        meeting_id: str,
        user_id: str,
        base64_audio: str,
        sample_rate: Optional[int] = None,
        client_sent_at_ms: Optional[int] = None,
    ):
        """
        Receive audio chunk, decode, append to buffer.
        If buffer is full, trigger processing.
        """
        try:
            audio_bytes = base64.b64decode(base64_audio)

            self._set_sample_rate(meeting_id, user_id, sample_rate)

            if self._should_use_deepgram_streaming():
                await self._send_audio_to_deepgram_stream(
                    meeting_id,
                    user_id,
                    audio_bytes,
                    sample_rate=sample_rate,
                    client_sent_at_ms=client_sent_at_ms,
                )
                return

            self._set_buffer_client_start(meeting_id, user_id, client_sent_at_ms)
            buffer_obj = self._get_buffer(meeting_id, user_id)
            buffer_obj.extend(audio_bytes)

            # Offload to background task to not block WebSocket loop.
            self._schedule_if_ready(meeting_id, user_id)
                
        except Exception as e:
            print(f"Error processing audio chunk: {e}")

    async def handle_transcription(
        self,
        meeting_id: str,
        user_id: str,
        pcm_data: bytes,
        client_audio_start_ms: Optional[int] = None,
    ):
        try:
            sample_rate = self._get_sample_rate(meeting_id, user_id)
            print(f"Transcribing {len(pcm_data)} bytes for {user_id} at {sample_rate}Hz...")
            wav_data = self.pcm_to_wav(pcm_data, sample_rate)
            text = await self._transcribe_audio(wav_data)

            if text:
                await self._handle_transcription_result(
                    meeting_id,
                    user_id,
                    text,
                    client_audio_start_ms=client_audio_start_ms,
                    provider=f"{self.stt_provider}-chunk",
                )

        except Exception as e:
            print(f"Transcription error: {e}")
        finally:
            # Clear busy flag and drain queued audio immediately.
            self._set_processing(meeting_id, user_id, False)
            self._schedule_if_ready(meeting_id, user_id)

    async def generate_ai_suggestion(
        self,
        meeting_id: str,
        user_id: str,
        text: str,
        metadata: Optional[Dict[str, Any]] = None,
    ):
        try:
            request_info = self._register_ai_request(meeting_id, user_id, metadata)
            request_sequence = request_info["sequence"]
            metadata = request_info["metadata"]
            request_origin = str(metadata.get("requestOrigin") or "manual")
            transcript_stage = str(metadata.get("transcriptStage") or "")
            is_draft_request = (
                request_origin == "auto-draft-transcription"
                or transcript_stage == "draft"
            )

            # 1a. Store Transcript to DB
            if not is_draft_request:
                self.save_transcript_to_db(meeting_id, user_id, text, "customer")

            # RAG Lookup
            embedding = await embedding_service.generate_embedding(text)
            if not embedding:
                 return
            if not self._is_latest_ai_request(meeting_id, user_id, request_sequence):
                print(f"Skipping stale AI task before context lookup for {meeting_id}/{user_id}")
                return

            # Determine Namespace based on Lead Product (Mock for now, should fetch from DB)
            # In real app: fetch session -> lead -> productType
            # For now, searching all relevant namespaces
            namespaces = [
                'training-reference',
                'fl-state-authority', 
                'cms-medicare'
            ]
            
            context_results = []
            citations = []
            
            for ns in namespaces:
                matches = pinecone_service.query(embedding, ns, top_k=2)
                for m in matches:
                    raw_score = m.score if hasattr(m, 'score') else 0
                    try:
                        score = float(raw_score)
                    except (TypeError, ValueError):
                        score = 0.0
                    if score > 0.75: # Compliance Threshold
                        text_content = m.metadata.get('text', '')
                        source = m.metadata.get('filename', 'Unknown Source')
                        context_results.append(f"[Source: {source} (Score: {score:.2f})]\n{text_content}")
                        citations.append({"source": source, "score": score, "text": text_content[:100] + "..."})

            if not self._is_latest_ai_request(meeting_id, user_id, request_sequence):
                print(f"Skipping stale AI task before response generation for {meeting_id}/{user_id}")
                return
            
            # Compliance Gate: No Sources Found
            if not context_results:
                if not self._is_latest_ai_request(meeting_id, user_id, request_sequence):
                    print(f"Skipping stale AI warning for {meeting_id}/{user_id}")
                    return
                latency_fields = self._build_ai_latency_fields(metadata)
                self._record_ai_latency_metrics(latency_fields)
                warning_msg = "⚠️ NO VERIFIED SOURCES FOUND. ESCALATE OR VERIFY MANUAL."
                await manager.broadcast_to_admin(meeting_id, {
                    "type": "ai-suggestion",
                    "suggestion": warning_msg,
                    "relatedTo": text,
                    "citations": [],
                    **latency_fields,
                })
                # Save AI response (warning) to transcript
                if not is_draft_request:
                    self.save_transcript_to_db(meeting_id, "ai_assistant", warning_msg, "ai")
                return

            # Format Context
            retrieved_context = "\n\n".join(context_results[:3]) 

            # System Prompt with Mandatory Disclaimers
            system_prompt = """
            You are a compliance-first AI insurance assistant. 
            Your role is to guide the agent based on the provided context.
            
            RULES:
            1. Suggest a SHORT, compliant response.
            2. IF context is missing, admit you don't know.
            3. ALWAYS include a mandatory disclaimer if mentioning benefits.
            4. Cite the source provided in context.
            """
            
            user_prompt = f"""
            Context from Knowledge Base:
            {retrieved_context}
            
            Customer just said: "{text}"
            
            Provide a short suggestion for the agent:
            """
            
            model = genai.GenerativeModel(self.ai_model_name)
            response = await model.generate_content_async(system_prompt + user_prompt)
            
            suggestion = response.text.strip()
            if not self._is_latest_ai_request(meeting_id, user_id, request_sequence):
                print(f"Skipping stale AI suggestion for {meeting_id}/{user_id}")
                return
            latency_fields = self._build_ai_latency_fields(metadata)
            self._record_ai_latency_metrics(latency_fields)
            
            # Broadcast Suggestion WITH Citations
            await manager.broadcast_to_admin(meeting_id, {
                "type": "ai-suggestion",
                "suggestion": suggestion,
                "relatedTo": text,
                "citations": citations,
                **latency_fields,
            })
            
            # Save AI response to transcript
            if not is_draft_request:
                self.save_transcript_to_db(meeting_id, "ai_assistant", suggestion, "ai")
            
        except asyncio.CancelledError:
            print(f"AI suggestion task cancelled for {meeting_id}/{user_id}")
            return
        except Exception as e:
            print(f"AI Suggestion error: {e}")

    def _resolve_session_id(self, db, meeting_id: str):
        from app.models import Session as DbSession, Appointment

        # Backward compatibility: meeting_id might already be a Session.id
        direct_session = db.query(DbSession).filter(DbSession.id == meeting_id).first()
        if direct_session:
            return direct_session.id

        # Normal flow: meeting_id maps to Appointment.meetingId, then to Session by leadId
        appointment = (
            db.query(Appointment)
            .filter(Appointment.meetingId == meeting_id)
            .order_by(Appointment.createdAt.desc())
            .first()
        )
        if not appointment:
            return None

        mapped_session = db.query(DbSession).filter(DbSession.leadId == appointment.leadId).first()
        return mapped_session.id if mapped_session else None

    def save_transcript_to_db(self, meeting_id: str, user_id: str, content: str, role: str):
        # Fire and forget db save
        try:
            from app.core.database import SessionLocal
            from app.models import Transcript
            
            # Start DB session
            db = SessionLocal()
            
            session_id = self._resolve_session_id(db, meeting_id)
            if not session_id:
                print(f"Transcript save skipped: could not resolve session for meeting {meeting_id}")
                db.close()
                return
            
            transcript_entry = Transcript(
                sessionId=session_id,
                role=role,
                content=content
            )
            db.add(transcript_entry)
            db.commit()
            db.close()
        except Exception as e:
            print(f"Error saving transcript: {e}")

    def pcm_to_wav(self, pcm_bytes: bytes, sample_rate: Optional[int] = None) -> bytes:
        target_rate = sample_rate if sample_rate else self.SAMPLE_RATE
        with io.BytesIO() as wav_io:
            with wave.open(wav_io, 'wb') as wav_file:
                wav_file.setnchannels(self.CHANNELS)
                wav_file.setsampwidth(self.SAMPLE_WIDTH)
                wav_file.setframerate(target_rate)
                wav_file.writeframes(pcm_bytes)
            return wav_io.getvalue()

audio_service = AudioService()
