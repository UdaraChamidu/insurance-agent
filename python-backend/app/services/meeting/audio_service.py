import io
import wave
import base64
import asyncio
import os
import time
import google.generativeai as genai
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
        
        self.model_name = "gemini-2.5-flash"
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

    def _normalize_request_text(self, text: str) -> str:
        return " ".join(text.strip().lower().split())

    def _create_noop_task(self) -> asyncio.Task:
        async def _noop():
            return None

        return asyncio.create_task(_noop())

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
        requested_at_ms = self._coerce_positive_int(safe_metadata.get("requestedAtMs"))
        source_audio_start_ms = self._coerce_positive_int(safe_metadata.get("sourceAudioStartMs"))
        source_transcription_at_ms = self._coerce_positive_int(safe_metadata.get("sourceTranscriptionAtMs"))
        ai_generated_at_ms = int(time.time() * 1000)

        return {
            "requestId": request_id,
            "requestOrigin": request_origin,
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
                print(f"Transcription: {text}")
                transcribed_at_ms = int(time.time() * 1000)
                transcription_latency_ms = (
                    transcribed_at_ms - client_audio_start_ms
                    if client_audio_start_ms
                    else None
                )
                self._record_latency_metric("audioToTranscriptMs", transcription_latency_ms)

                # 1. Broadcast Transcription
                await manager.broadcast_to_admin(meeting_id, {
                    "type": "transcription",
                    "userId": user_id,
                    "text": text,
                    "timestamp": "now", # In real app use ISO format
                    "clientAudioStartMs": client_audio_start_ms,
                    "transcribedAtMs": transcribed_at_ms,
                    "transcriptionLatencyMs": transcription_latency_ms,
                })

                # 2. Optionally auto-generate AI suggestions without blocking transcription loop.
                if self.AUTO_AI_ON_TRANSCRIPTION and len(text) > 10:
                    self.enqueue_ai_suggestion(
                        meeting_id,
                        user_id,
                        text,
                        metadata={
                            "requestOrigin": "auto-transcription",
                            "requestedAtMs": transcribed_at_ms,
                            "sourceAudioStartMs": client_audio_start_ms,
                            "sourceTranscriptionAtMs": transcribed_at_ms,
                        },
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

            # 1a. Store Transcript to DB
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
            
            model = genai.GenerativeModel(self.model_name)
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

