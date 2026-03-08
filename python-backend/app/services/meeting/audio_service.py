import io
import wave
import base64
import asyncio
import os
import time
import json
import inspect
import re
from collections import OrderedDict
import google.generativeai as genai
import requests
import websockets
from urllib.parse import urlencode
from typing import Dict, Any, List, Optional
from app.core.config import settings
from app.services.meeting.websocket_manager import manager
from app.services.integrations.pinecone import pinecone_service
from app.services.llm.embeddings import embedding_service
from app.services.llm.usage_tracker import gemini_usage_tracker
from app.services.rag.audit_logger import rag_audit_logger
from app.services.rag.intent_router import intent_router
_KEYWORD_BACKEND = os.getenv("KEYWORD_INDEX_BACKEND", "sqlite").lower()
if _KEYWORD_BACKEND == "sqlite":
    from app.services.rag.keyword_index_sqlite import sqlite_keyword_index_service as keyword_index_service
else:
    from app.services.rag.keyword_index import keyword_index_service
from app.services.rag.redaction import redaction_service

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
            150,  # reduced from 300ms for lower perceived latency
        )
        self.deepgram_utterance_end_ms = self._read_non_negative_int_env(
            "MEETING_DEEPGRAM_UTTERANCE_END_MS",
            600,  # reduced from 1000ms for faster utterance detection
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
        rag_namespaces_env = os.getenv("MEETING_RAG_NAMESPACES", "").strip()
        if rag_namespaces_env:
            self.rag_namespaces = [ns.strip() for ns in rag_namespaces_env.split(",") if ns.strip()]
        else:
            default_namespaces = list(getattr(pinecone_service, "namespaces", {}).values())
            self.rag_namespaces = list(dict.fromkeys(default_namespaces)) if default_namespaces else [
                "fl-state-authority",
                "cms-medicare",
                "federal-aca",
                "erisa-irs-selffunded",
                "fl-medicaid-agency",
                "carrier-fmo-policies",
            ]
        self.rag_namespaces = [ns for ns in self.rag_namespaces if ns != "training-reference"]
        self.rag_top_k_per_namespace = max(
            1,
            self._read_non_negative_int_env("MEETING_RAG_TOP_K_PER_NAMESPACE", 3),
        )
        self.rag_vector_top_k = max(
            1,
            self._read_non_negative_int_env("MEETING_RAG_VECTOR_TOP_K", 30),
        )
        self.rag_keyword_top_k = max(
            1,
            self._read_non_negative_int_env("MEETING_RAG_KEYWORD_TOP_K", 30),
        )
        self.rag_return_top_k = max(
            1,
            self._read_non_negative_int_env("MEETING_RAG_RETURN_TOP_K", 8),
        )
        self.rag_intent_min_confidence = self._read_non_negative_float_env(
            "MEETING_RAG_INTENT_MIN_CONFIDENCE",
            0.25,
        )
        self.rag_evidence_min_confidence = self._read_non_negative_float_env(
            "MEETING_RAG_EVIDENCE_MIN_CONFIDENCE",
            0.58,
        )
        self.rag_stage_boost = self._read_non_negative_float_env("MEETING_RAG_STAGE_BOOST", 0.06)
        self.progressive_assist_enabled = (
            os.getenv("MEETING_PROGRESSIVE_ASSIST", "true").lower()
            in {"1", "true", "yes", "on"}
        )
        self.progressive_question_count = max(
            1,
            self._read_non_negative_int_env("MEETING_PROGRESSIVE_QUESTION_COUNT", 2),
        )
        self.rag_min_score = self._read_non_negative_float_env("MEETING_RAG_MIN_SCORE", 0.62)
        self.rag_fallback_min_score = self._read_non_negative_float_env(
            "MEETING_RAG_FALLBACK_MIN_SCORE",
            max(0.35, self.rag_min_score - 0.17),
        )
        if self.rag_fallback_min_score > self.rag_min_score:
            self.rag_fallback_min_score = self.rag_min_score
        self.allow_unverified_ai_fallback = (
            os.getenv("MEETING_ALLOW_UNVERIFIED_AI_FALLBACK", "true").lower()
            in {"1", "true", "yes", "on"}
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

        # Embedding cache: normalized_text -> {"embedding": [...], "ts": float}
        # LRU eviction at max 500 entries, TTL 300s
        self._embedding_cache: OrderedDict = OrderedDict()
        self._embedding_cache_ttl_s: int = 300
        self._embedding_cache_max: int = 500

        # Intent card semantic embeddings (pre-computed at startup for Phase 2A routing)
        # Each entry: {"card": {...}, "embedding": [...], "_norm": float}
        self._intent_embeddings: List[Dict[str, Any]] = []
        self._intent_embeddings_loading: bool = False

        # Deterministic disclaimer library (Phase 3A)
        self._disclaimer_library: Dict[str, str] = self._load_disclaimer_library()

        # Cohere reranker (optional — gracefully disabled if key/package missing)
        self._cohere_client = None
        cohere_api_key = os.getenv("COHERE_API_KEY", "").strip()
        cohere_rerank_model = os.getenv("COHERE_RERANK_MODEL", "rerank-english-v3.0").strip()
        self._cohere_rerank_model = cohere_rerank_model
        self._cohere_rerank_top_n = max(1, self._read_non_negative_int_env("COHERE_RERANK_TOP_N", 8))
        if cohere_api_key:
            try:
                import cohere as _cohere
                self._cohere_client = _cohere.Client(cohere_api_key)
                print(f"Cohere reranker enabled: model={cohere_rerank_model}")
            except ImportError:
                print("cohere package not installed — using token-overlap reranking fallback")

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

    def _extract_context_flags(self, metadata: Optional[Dict[str, Any]]) -> Dict[str, str]:
        safe = metadata if isinstance(metadata, dict) else {}
        return {
            "state": str(
                safe.get("state")
                or safe.get("State")
                or "FL"
            ).strip() or "FL",
            "product_universe": str(
                safe.get("product_universe")
                or safe.get("productUniverse")
                or safe.get("ProductUniverse")
                or ""
            ).strip(),
            "regulator": str(safe.get("regulator") or safe.get("Regulator") or "").strip(),
            "process_stage": str(
                safe.get("process_stage")
                or safe.get("processStage")
                or ""
            ).strip(),
            "carrier": str(safe.get("carrier") or safe.get("Carrier") or "").strip(),
            "doc_type": str(safe.get("doc_type") or safe.get("docType") or "").strip(),
        }

    def _namespace_candidates_for_universe(self, product_universe: str) -> List[str]:
        universe = (product_universe or "").strip().lower()
        if not universe:
            return [ns for ns in self.rag_namespaces if ns]

        mapping = {
            "medicare": ["cms-medicare"],
            "aca": ["federal-aca"],
            "medigap": ["cms-medicare", "fl-state-authority"],
            "selffunded_erisa": ["erisa-irs-selffunded"],
            "mewa": ["erisa-irs-selffunded"],
            "medicaid": ["fl-medicaid-agency"],
            "general": ["fl-state-authority", "cms-medicare", "federal-aca", "carrier-fmo-policies"],
        }
        mapped = mapping.get(universe)
        if mapped:
            return [ns for ns in mapped if ns in self.rag_namespaces]
        return [ns for ns in self.rag_namespaces if ns]

    def _build_retrieval_filter(
        self,
        context_flags: Dict[str, str],
        intent_payload: Dict[str, Any],
    ) -> Dict[str, Any]:
        filter_payload: Dict[str, Any] = {}

        state = context_flags.get("state")
        if state:
            filter_payload["state"] = {"$eq": state}

        product_universe = (
            context_flags.get("product_universe")
            or str(intent_payload.get("product_universe") or "").strip()
        )
        if product_universe and product_universe.lower() != "general":
            filter_payload["product_universe"] = {"$eq": product_universe}

        regulators = [str(v).strip() for v in (intent_payload.get("primary_regulators") or []) if str(v).strip()]
        if regulators:
            filter_payload["regulator"] = {"$in": regulators}

        preferred_doc_types = [
            str(v).strip()
            for v in (intent_payload.get("preferred_doc_types") or [])
            if str(v).strip()
        ]
        if preferred_doc_types:
            filter_payload["doc_type"] = {"$in": preferred_doc_types}

        carrier = context_flags.get("carrier")
        if carrier:
            filter_payload["carrier"] = {"$eq": carrier}

        return filter_payload

    def _relax_retrieval_filter(self, filter_payload: Dict[str, Any], stage: int) -> Dict[str, Any]:
        """Return a progressively relaxed copy of filter_payload.

        stage 1: drop regulator + doc_type  (keep state + product_universe + carrier)
        stage 2: drop product_universe too  (keep state + carrier)
        stage 3: drop all filters           (unrestricted search)
        """
        relaxed = dict(filter_payload)
        if stage >= 1:
            relaxed.pop("regulator", None)
            relaxed.pop("doc_type", None)
        if stage >= 2:
            relaxed.pop("product_universe", None)
        if stage >= 3:
            relaxed.clear()
        return relaxed

    async def _run_hybrid_retrieval(
        self,
        embedding: List[float],
        namespaces: List[str],
        filter_payload: Dict[str, Any],
        redacted_text: str,
        process_stage: str,
    ) -> List[Dict[str, Any]]:
        """Run parallel vector+keyword search, fuse, dedupe, and rerank. Returns ranked hits."""
        per_namespace_top_k = max(
            self.rag_top_k_per_namespace,
            int(self.rag_vector_top_k / max(len(namespaces), 1)),
        )
        vector_hits_task = asyncio.create_task(
            self._query_vector_hits_parallel(
                embedding=embedding,
                namespaces=namespaces,
                top_k_per_namespace=per_namespace_top_k,
                filter_payload=filter_payload,
            )
        )
        keyword_hits_task = asyncio.create_task(
            self._query_keyword_hits(
                query_text=redacted_text,
                top_k=self.rag_keyword_top_k,
                filter_payload=filter_payload,
            )
        )
        raw_vector_hits, keyword_hits_raw = await asyncio.gather(vector_hits_task, keyword_hits_task)
        vector_hits = self._dedupe_rank_hits(
            raw_vector_hits, process_stage=process_stage
        )[: self.rag_vector_top_k]
        fused_hits = self._fuse_hits(vector_hits, keyword_hits_raw, redacted_text)
        ranked_hits = self._dedupe_rank_hits(fused_hits, process_stage=process_stage)
        ranked_hits = await self._rerank_hits_async(redacted_text, ranked_hits, keep_top=40)
        return ranked_hits

    def _extract_exact_tokens(self, query: str) -> List[str]:
        tokens = set()
        normalized = self._normalize_request_text(query)
        for token in re.findall(r"\b[a-z0-9\-]{2,}\b", normalized):
            if token in {"1095-a", "aptc", "csr", "sep", "aep", "oep", "cfr", "usc"}:
                tokens.add(token)
            elif any(ch.isdigit() for ch in token):
                tokens.add(token)
        return sorted(tokens)

    def _get_cached_embedding(self, normalized_text: str) -> Optional[List[float]]:
        entry = self._embedding_cache.get(normalized_text)
        if entry and (time.time() - entry["ts"]) < self._embedding_cache_ttl_s:
            self._embedding_cache.move_to_end(normalized_text)
            return entry["embedding"]
        return None

    def _set_cached_embedding(self, normalized_text: str, embedding: List[float]) -> None:
        if normalized_text in self._embedding_cache:
            self._embedding_cache.move_to_end(normalized_text)
        self._embedding_cache[normalized_text] = {"embedding": embedding, "ts": time.time()}
        while len(self._embedding_cache) > self._embedding_cache_max:
            self._embedding_cache.popitem(last=False)

    def _load_disclaimer_library(self) -> Dict[str, str]:
        """Load versioned disclaimer texts from disclaimer_library.json."""
        library_path = os.path.join(
            os.path.dirname(__file__), "..", "rag", "disclaimer_library.json"
        )
        try:
            with open(library_path, "r", encoding="utf-8") as fh:
                data = json.load(fh)
            result: Dict[str, str] = {}
            for disc_id, entry in (data.get("disclaimers") or {}).items():
                text = str(entry.get("text") or "").strip()
                if text:
                    result[disc_id] = text
            print(f"Disclaimer library loaded: {len(result)} entries")
            return result
        except Exception as disc_err:
            print(f"Disclaimer library load failed: {disc_err}")
            return {}

    def _resolve_disclaimers(self, required_ids: List[str]) -> List[str]:
        """Return deterministic disclaimer texts for the given IDs (always include general_informational)."""
        ids = list(required_ids or [])
        if "general_informational" not in ids:
            ids.append("general_informational")
        texts: List[str] = []
        for disc_id in ids:
            text = self._disclaimer_library.get(disc_id)
            if text:
                texts.append(text)
        return texts

    async def _preload_intent_embeddings(self) -> None:
        """Embed each intent card once at startup for semantic routing (Phase 2A)."""
        cards = getattr(intent_router, "cards", [])
        if not cards:
            return
        loaded: List[Dict[str, Any]] = []
        for card in cards:
            parts = [
                str(card.get("intent_id", "")).replace("_", " ").lower(),
                " ".join(str(k) for k in (card.get("keywords") or [])),
                " ".join(str(q) for q in (card.get("must_ask_questions") or [])),
            ]
            text = " ".join(p for p in parts if p.strip())
            if not text.strip():
                continue
            emb = await self._generate_query_embedding(text)
            if emb:
                norm = sum(x * x for x in emb) ** 0.5
                loaded.append({"card": card, "embedding": emb, "_norm": norm})
        self._intent_embeddings = loaded
        print(f"Intent semantic embeddings preloaded: {len(loaded)} cards")

    def _semantic_route_intent(
        self, query_embedding: List[float], threshold: float = 0.55
    ) -> Optional[Dict[str, Any]]:
        """Return the best-matching intent card by cosine similarity, or None if below threshold."""
        if not self._intent_embeddings or not query_embedding:
            return None
        q_norm = sum(x * x for x in query_embedding) ** 0.5
        if q_norm == 0:
            return None
        best_sim = 0.0
        best_card: Optional[Dict[str, Any]] = None
        for entry in self._intent_embeddings:
            c = entry["embedding"]
            c_norm = entry["_norm"]
            if c_norm == 0:
                continue
            dot = sum(a * b for a, b in zip(query_embedding, c))
            sim = dot / (q_norm * c_norm)
            if sim > best_sim:
                best_sim = sim
                best_card = entry["card"]
        if best_sim < threshold or best_card is None:
            return None
        card = best_card
        return {
            "intent_id": str(card.get("intent_id") or "UNKNOWN"),
            "confidence": float(min(best_sim, 1.0)),
            "clarifying_questions": [],
            "product_universe": str(card.get("product_universe") or "General"),
            "primary_regulators": [str(v) for v in (card.get("primary_regulators") or []) if str(v).strip()],
            "preferred_doc_types": [str(v) for v in (card.get("preferred_doc_types") or []) if str(v).strip()],
            "required_disclaimers": [str(v) for v in (card.get("required_disclaimers") or []) if str(v).strip()],
            "must_ask_questions": [str(v) for v in (card.get("must_ask_questions") or []) if str(v).strip()],
            "escalation_triggers": [str(v) for v in (card.get("escalation_triggers") or []) if str(v).strip()],
            "top_candidates": [{"intent_id": str(card.get("intent_id") or "UNKNOWN"), "confidence": float(min(best_sim, 1.0))}],
        }

    async def _generate_query_embedding(self, text: str):
        cache_key = self._normalize_request_text(text)
        cached = self._get_cached_embedding(cache_key)
        if cached is not None:
            return cached

        query_embed_fn = getattr(embedding_service, "generate_query_embedding", None)
        if callable(query_embed_fn) and inspect.iscoroutinefunction(query_embed_fn):
            try:
                query_result = await query_embed_fn(text)
                if query_result:
                    self._set_cached_embedding(cache_key, query_result)
                    return query_result
            except Exception as query_embedding_error:
                print(f"Query embedding fallback: {query_embedding_error}")
        embedding = await embedding_service.generate_embedding(text)
        if embedding:
            self._set_cached_embedding(cache_key, embedding)
        return embedding

    def _is_auto_request(self, request_origin: str) -> bool:
        normalized = str(request_origin or "").strip().lower()
        return normalized.startswith("auto")

    def _build_progressive_message(self, intent_payload: Dict[str, Any]) -> str:
        ask_next = [
            str(item).strip()
            for item in (intent_payload.get("must_ask_questions") or [])
            if str(item).strip()
        ][: self.progressive_question_count]
        if not ask_next:
            ask_next = [
                "Can you confirm the product and policy context?",
                "Can you confirm the state and effective date details?",
            ][: self.progressive_question_count]

        lines = [
            "Ask next now:",
            *[f"- {question}" for question in ask_next],
            "Safe line: Let me verify the exact rule and citation before confirming.",
        ]
        return "\n".join(lines)

    async def _emit_progressive_update(
        self,
        meeting_id: str,
        text: str,
        metadata: Dict[str, Any],
        intent_payload: Dict[str, Any],
    ) -> None:
        if not self.progressive_assist_enabled:
            return

        request_origin = str(metadata.get("requestOrigin") or "manual")
        transcript_stage = str(metadata.get("transcriptStage") or "")
        if not self._is_auto_request(request_origin):
            return
        if transcript_stage == "draft":
            return

        latency_fields = self._build_ai_latency_fields(metadata)
        progressive_message = self._build_progressive_message(intent_payload)
        await manager.broadcast_to_admin(meeting_id, {
            "type": "ai-suggestion",
            "suggestion": progressive_message,
            "relatedTo": text,
            "citations": [],
            "contextSourceMode": "progressive",
            "transcriptStage": "draft",
            **latency_fields,
        })

    async def _query_namespace_vector_hits(
        self,
        embedding: List[float],
        namespace: str,
        top_k: int,
        filter_payload: Dict[str, Any],
    ) -> List[Dict[str, Any]]:
        try:
            matches = await asyncio.to_thread(
                pinecone_service.query,
                embedding,
                namespace,
                top_k,
                filter_payload or None,
            )
        except Exception as query_err:
            print(f"Pinecone query failed for namespace '{namespace}': {query_err}")
            return []

        parsed_hits: List[Dict[str, Any]] = []
        for match_obj in (matches or []):
            parsed_hit = self._parse_match_hit(match_obj, namespace)
            if parsed_hit:
                parsed_hits.append(parsed_hit)
        return parsed_hits

    async def _query_vector_hits_parallel(
        self,
        embedding: List[float],
        namespaces: List[str],
        top_k_per_namespace: int,
        filter_payload: Dict[str, Any],
    ) -> List[Dict[str, Any]]:
        tasks = [
            self._query_namespace_vector_hits(
                embedding=embedding,
                namespace=ns,
                top_k=top_k_per_namespace,
                filter_payload=filter_payload,
            )
            for ns in namespaces
        ]
        if not tasks:
            return []
        groups = await asyncio.gather(*tasks, return_exceptions=True)
        merged: List[Dict[str, Any]] = []
        for group in groups:
            if isinstance(group, Exception):
                continue
            merged.extend(group)
        return merged

    async def _query_keyword_hits(
        self,
        query_text: str,
        top_k: int,
        filter_payload: Dict[str, Any],
    ) -> List[Dict[str, Any]]:
        try:
            return await asyncio.to_thread(
                keyword_index_service.search,
                query_text,
                top_k,
                filter_payload,
            )
        except Exception as keyword_err:
            print(f"Keyword search failed: {keyword_err}")
            return []

    def _parse_match_hit(self, match_obj: Any, namespace: str) -> Optional[Dict[str, Any]]:
        metadata = getattr(match_obj, "metadata", None)
        if metadata is None and isinstance(match_obj, dict):
            metadata = match_obj.get("metadata")
        if not isinstance(metadata, dict):
            metadata = {}

        text_content = str(
            metadata.get("text")
            or metadata.get("content")
            or metadata.get("chunk_text")
            or metadata.get("chunk")
            or ""
        ).strip()
        if not text_content:
            return None

        source = str(
            metadata.get("source_title")
            or metadata.get("filename")
            or metadata.get("source")
            or metadata.get("title")
            or metadata.get("document_id")
            or f"{namespace}-document"
        )
        raw_score = getattr(match_obj, "score", 0)
        if raw_score is None and isinstance(match_obj, dict):
            raw_score = match_obj.get("score", 0)
        raw_id = getattr(match_obj, "id", None)
        if raw_id is None and isinstance(match_obj, dict):
            raw_id = match_obj.get("id")
        try:
            score = float(raw_score)
        except (TypeError, ValueError):
            score = 0.0

        return {
            "chunk_id": str(metadata.get("chunk_id") or raw_id or ""),
            "doc_id": str(metadata.get("doc_id") or metadata.get("document_id") or ""),
            "source": source,
            "namespace": namespace,
            "text": text_content,
            "score": score,
            "section_path": str(metadata.get("section_path") or ""),
            "page_start": metadata.get("page_start"),
            "page_end": metadata.get("page_end"),
            "doc_version": str(metadata.get("doc_version") or ""),
            "effective_date": str(metadata.get("effective_date") or ""),
            "citation_prefix": str(metadata.get("citation_prefix") or ""),
            "regulator": str(metadata.get("regulator") or ""),
            "authority_level": str(metadata.get("authority_level") or ""),
            "process_stage": str(metadata.get("process_stage") or ""),
            "sharepoint_url": str(metadata.get("sharepoint_url") or ""),
            "product_universe": str(metadata.get("product_universe") or ""),
            "metadata": metadata,
        }

    def _normalize_keyword_hit(self, hit: Dict[str, Any]) -> Dict[str, Any]:
        metadata = hit.get("metadata") or {}
        source = str(
            hit.get("source")
            or metadata.get("source_title")
            or metadata.get("filename")
            or "keyword-document"
        )
        return {
            "chunk_id": str(hit.get("chunk_id") or metadata.get("chunk_id") or ""),
            "doc_id": str(metadata.get("doc_id") or metadata.get("document_id") or ""),
            "source": source,
            "namespace": str(hit.get("namespace") or metadata.get("namespace") or "unknown"),
            "text": str(hit.get("text") or ""),
            "score": float(hit.get("score") or 0.0),
            "section_path": str(metadata.get("section_path") or ""),
            "page_start": metadata.get("page_start"),
            "page_end": metadata.get("page_end"),
            "doc_version": str(metadata.get("doc_version") or ""),
            "effective_date": str(metadata.get("effective_date") or ""),
            "citation_prefix": str(metadata.get("citation_prefix") or ""),
            "regulator": str(metadata.get("regulator") or ""),
            "authority_level": str(metadata.get("authority_level") or ""),
            "process_stage": str(metadata.get("process_stage") or ""),
            "sharepoint_url": str(metadata.get("sharepoint_url") or ""),
            "product_universe": str(metadata.get("product_universe") or ""),
            "metadata": metadata,
        }

    def _fuse_hits(
        self,
        vector_hits: List[Dict[str, Any]],
        keyword_hits: List[Dict[str, Any]],
        query_text: str,
    ) -> List[Dict[str, Any]]:
        exact_tokens = self._extract_exact_tokens(query_text)
        keyword_weight = 0.7 if exact_tokens else 0.5
        vector_weight = 1.0 - keyword_weight
        if not keyword_hits:
            keyword_weight = 0.0
            vector_weight = 1.0
        elif not vector_hits:
            keyword_weight = 1.0
            vector_weight = 0.0

        max_vector = max([float(hit.get("score", 0.0)) for hit in vector_hits] or [1.0])
        max_keyword = max([float(hit.get("score", 0.0)) for hit in keyword_hits] or [1.0])
        if max_vector <= 0:
            max_vector = 1.0
        if max_keyword <= 0:
            max_keyword = 1.0

        fused: Dict[str, Dict[str, Any]] = {}

        for hit in vector_hits:
            key = str(hit.get("chunk_id") or f"{hit.get('source')}::{hit.get('text','')[:120]}")
            normalized_score = float(hit.get("score", 0.0)) / max_vector
            payload = dict(hit)
            payload["vector_score"] = normalized_score
            payload["keyword_score"] = 0.0
            payload["score"] = vector_weight * normalized_score
            fused[key] = payload

        for raw_hit in keyword_hits:
            hit = self._normalize_keyword_hit(raw_hit)
            key = str(hit.get("chunk_id") or f"{hit.get('source')}::{hit.get('text','')[:120]}")
            normalized_score = float(hit.get("score", 0.0)) / max_keyword
            if key in fused:
                fused[key]["keyword_score"] = max(float(fused[key].get("keyword_score", 0.0)), normalized_score)
                fused[key]["score"] = (
                    vector_weight * float(fused[key].get("vector_score", 0.0))
                    + keyword_weight * float(fused[key].get("keyword_score", 0.0))
                )
                # Prefer richer metadata if one side has empty values.
                if len(str(fused[key].get("text", ""))) < len(str(hit.get("text", ""))):
                    fused[key]["text"] = hit.get("text", "")
            else:
                payload = dict(hit)
                payload["vector_score"] = 0.0
                payload["keyword_score"] = normalized_score
                payload["score"] = keyword_weight * normalized_score
                fused[key] = payload

        return list(fused.values())

    def _dedupe_rank_hits(self, hits: List[Dict[str, Any]], process_stage: str = "") -> List[Dict[str, Any]]:
        boosted_hits = []
        for hit in hits:
            payload = dict(hit)
            score = float(payload.get("score", 0.0))
            if process_stage:
                chunk_stage = str(payload.get("process_stage") or "").strip().lower()
                if chunk_stage and chunk_stage == process_stage.strip().lower():
                    score += self.rag_stage_boost
            payload["score"] = score
            boosted_hits.append(payload)

        ranked = sorted(boosted_hits, key=lambda item: item.get("score", 0.0), reverse=True)
        unique: List[Dict[str, Any]] = []
        seen = set()
        for hit in ranked:
            key = str(hit.get("chunk_id") or f"{hit.get('source')}::{hit.get('text', '')[:160]}")
            if key in seen:
                continue
            seen.add(key)
            unique.append(hit)
        return unique

    def _compute_evidence_confidence(self, query_text: str, hits: List[Dict[str, Any]]) -> float:
        if not hits:
            return 0.0

        top_hits = hits[: min(len(hits), self.rag_return_top_k)]
        avg_score = sum(float(hit.get("score", 0.0)) for hit in top_hits) / max(len(top_hits), 1)
        source_count = len({str(hit.get("source") or "") for hit in top_hits if str(hit.get("source") or "").strip()})
        source_factor = min(1.0, source_count / 3.0)

        exact_tokens = self._extract_exact_tokens(query_text)
        if not exact_tokens:
            token_factor = 1.0
        else:
            combined_text = " ".join(str(hit.get("text") or "").lower() for hit in top_hits)
            token_factor = (
                len([token for token in exact_tokens if token in combined_text]) / max(len(exact_tokens), 1)
            )

        confidence = 0.55 * avg_score + 0.25 * source_factor + 0.20 * token_factor
        return max(0.0, min(1.0, confidence))

    def _rerank_hits_token_overlap(self, query_text: str, hits: List[Dict[str, Any]], keep_top: int = 40) -> List[Dict[str, Any]]:
        """Fast token-overlap reranker — used as fallback when Cohere is unavailable."""
        query_tokens = set(re.findall(r"[a-z0-9\-]+", query_text.lower()))
        if not query_tokens:
            return hits[:keep_top]

        rescored: List[Dict[str, Any]] = []
        for hit in hits:
            payload = dict(hit)
            text_tokens = set(re.findall(r"[a-z0-9\-]+", str(payload.get("text") or "").lower()))
            overlap = len(query_tokens.intersection(text_tokens)) / max(len(query_tokens), 1)
            payload["score"] = float(payload.get("score", 0.0)) + (0.2 * overlap)
            rescored.append(payload)
        rescored.sort(key=lambda item: item.get("score", 0.0), reverse=True)
        return rescored[: max(1, keep_top)]

    async def _rerank_hits_async(self, query_text: str, hits: List[Dict[str, Any]], keep_top: int = 40) -> List[Dict[str, Any]]:
        """
        Rerank using Cohere cross-encoder when available, else token-overlap fallback.
        Cohere cross-encoder reads query + chunk together — far more accurate than bi-encoder alone.
        """
        if not hits:
            return hits

        if self._cohere_client is None:
            return self._rerank_hits_token_overlap(query_text, hits, keep_top)

        candidates = hits[:min(len(hits), 40)]
        documents = [str(h.get("text") or "") for h in candidates]
        # Filter out empty docs to avoid Cohere API errors
        valid_indices = [i for i, d in enumerate(documents) if d.strip()]
        if not valid_indices:
            return self._rerank_hits_token_overlap(query_text, hits, keep_top)

        valid_docs = [documents[i] for i in valid_indices]
        valid_candidates = [candidates[i] for i in valid_indices]

        try:
            result = await asyncio.to_thread(
                self._cohere_client.rerank,
                query=query_text,
                documents=valid_docs,
                model=self._cohere_rerank_model,
                top_n=min(self._cohere_rerank_top_n, len(valid_docs)),
            )
            reranked: List[Dict[str, Any]] = []
            for r in result.results:
                payload = dict(valid_candidates[r.index])
                payload["score"] = float(r.relevance_score)
                reranked.append(payload)
            return reranked
        except Exception as cohere_err:
            print(f"Cohere rerank failed, using token-overlap fallback: {cohere_err}")
            return self._rerank_hits_token_overlap(query_text, hits, keep_top)

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
        try:
            model = genai.GenerativeModel(self.ai_model_name)
            response = await model.generate_content_async([
                {
                    "mime_type": "audio/wav",
                    "data": wav_data
                },
                "Transcribe this audio exactly. Return ONLY the spoken words. If silence, return empty string."
            ])
            gemini_usage_tracker.record_response(
                operation="meeting_transcription",
                response_payload=response,
                request_text="Transcribe this audio exactly. Return ONLY the spoken words. If silence, return empty string.",
            )
            return (response.text or "").strip()
        except Exception as e:
            gemini_usage_tracker.record_error("meeting_transcription", e)
            raise

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

            if not is_draft_request:
                self.save_transcript_to_db(meeting_id, user_id, text, "customer")

            # Trigger intent embedding preload on first request (non-blocking)
            if not self._intent_embeddings and not self._intent_embeddings_loading:
                self._intent_embeddings_loading = True
                asyncio.create_task(self._preload_intent_embeddings())

            context_mode = "none"
            context_results: List[str] = []
            citations: List[Dict[str, Any]] = []
            retrieval_filter: Dict[str, Any] = {}
            selected_hits: List[Dict[str, Any]] = []
            evidence_confidence = 0.0
            active_filter_label = "strict"
            context_flags = self._extract_context_flags(metadata)
            redacted_text = redaction_service.redact(text)
            intent_payload = intent_router.route(redacted_text)
            intent_confidence = float(intent_payload.get("confidence") or 0.0)
            retrieval_filter = self._build_retrieval_filter(context_flags, intent_payload)

            target_universe = (
                context_flags.get("product_universe")
                or str(intent_payload.get("product_universe") or "").strip()
            )
            namespaces = self._namespace_candidates_for_universe(target_universe)
            if not namespaces:
                namespaces = [ns for ns in self.rag_namespaces if ns]

            intent_needs_clarification = (
                intent_payload.get("intent_id") == "UNKNOWN"
                or intent_confidence < self.rag_intent_min_confidence
            )

            if self._is_latest_ai_request(meeting_id, user_id, request_sequence):
                await self._emit_progressive_update(
                    meeting_id=meeting_id,
                    text=text,
                    metadata=metadata,
                    intent_payload=intent_payload,
                )

            embedding = await self._generate_query_embedding(redacted_text)
            if embedding:
                if not self._is_latest_ai_request(meeting_id, user_id, request_sequence):
                    print(f"Skipping stale AI task before context lookup for {meeting_id}/{user_id}")
                    return

                # Phase 2A: Semantic intent refinement — reuse query embedding to boost routing.
                # Only overrides keyword routing if cosine similarity is meaningfully higher.
                if self._intent_embeddings:
                    semantic_result = self._semantic_route_intent(embedding)
                    if semantic_result and semantic_result["confidence"] > intent_confidence + 0.10:
                        intent_payload = semantic_result
                        intent_confidence = semantic_result["confidence"]
                        intent_needs_clarification = False
                        retrieval_filter = self._build_retrieval_filter(context_flags, intent_payload)
                        target_universe = (
                            context_flags.get("product_universe")
                            or str(intent_payload.get("product_universe") or "").strip()
                        )
                        namespaces = self._namespace_candidates_for_universe(target_universe)
                        if not namespaces:
                            namespaces = [ns for ns in self.rag_namespaces if ns]

                # Build a progressive relaxation ladder for the retrieval filter.
                # Start strict; widen only if evidence confidence is too low.
                filter_stages: List[tuple] = [(retrieval_filter, "strict")]
                if retrieval_filter.get("regulator") or retrieval_filter.get("doc_type"):
                    filter_stages.append(
                        (self._relax_retrieval_filter(retrieval_filter, 1), "relaxed_regulator")
                    )
                if retrieval_filter.get("product_universe"):
                    filter_stages.append(
                        (self._relax_retrieval_filter(retrieval_filter, 2), "relaxed_universe")
                    )
                filter_stages.append(
                    (self._relax_retrieval_filter(retrieval_filter, 3), "no_filter")
                )

                active_filter_label = "strict"
                process_stage_flag = context_flags.get("process_stage", "")
                for stage_filter, stage_label in filter_stages:
                    active_filter_label = stage_label
                    ranked_hits = await self._run_hybrid_retrieval(
                        embedding=embedding,
                        namespaces=namespaces,
                        filter_payload=stage_filter,
                        redacted_text=redacted_text,
                        process_stage=process_stage_flag,
                    )

                    verified_hits = [
                        h for h in ranked_hits if float(h.get("score", 0.0)) >= self.rag_min_score
                    ]
                    fallback_hits = [
                        h for h in ranked_hits if float(h.get("score", 0.0)) >= self.rag_fallback_min_score
                    ]
                    selected_hits = verified_hits if verified_hits else fallback_hits
                    if verified_hits:
                        context_mode = "verified"
                    elif fallback_hits:
                        context_mode = "fallback"
                    else:
                        context_mode = "unverified"

                    evidence_confidence = self._compute_evidence_confidence(
                        redacted_text,
                        selected_hits if selected_hits else ranked_hits,
                    )
                    if evidence_confidence >= self.rag_evidence_min_confidence:
                        break  # Good evidence found — stop relaxing

                    selected_hits = []
                    context_mode = "weak_evidence"
                    if stage_label == "no_filter":
                        break  # Exhausted all relaxation stages
                    print(f"RAG: weak evidence with filter={stage_label} (conf={evidence_confidence:.3f}), relaxing...")

                if intent_needs_clarification and not selected_hits:
                    context_mode = "needs_clarification"

                for hit in selected_hits[: self.rag_return_top_k]:
                    source = str(hit.get("source", "Unknown Source"))
                    namespace = str(hit.get("namespace", "unknown"))
                    score = float(hit.get("score", 0.0))
                    source_text = str(hit.get("text", ""))
                    section_path = str(hit.get("section_path") or "Unknown section")
                    doc_version = str(hit.get("doc_version") or "n/a")
                    effective_date = str(hit.get("effective_date") or "n/a")

                    context_results.append(
                        (
                            f"[Source: {source} | Namespace: {namespace} | Score: {score:.2f} | "
                            f"Section: {section_path} | Version: {doc_version} | Effective: {effective_date}]"
                            f"\n{source_text}"
                        )
                    )
                    citations.append({
                        "chunkId": hit.get("chunk_id"),
                        "docId": hit.get("doc_id"),
                        "source": source,
                        "namespace": namespace,
                        "score": score,
                        "sectionPath": section_path,
                        "pageStart": hit.get("page_start"),
                        "pageEnd": hit.get("page_end"),
                        "docVersion": doc_version,
                        "effectiveDate": effective_date,
                        "citationPrefix": hit.get("citation_prefix"),
                        "regulator": hit.get("regulator"),
                        "authorityLevel": hit.get("authority_level"),
                        "sharepointUrl": hit.get("sharepoint_url"),
                        "text": (source_text[:120] + "...") if len(source_text) > 120 else source_text,
                    })
            else:
                print(f"Embedding generation failed for AI suggestion in {meeting_id}/{user_id}")

            if not self._is_latest_ai_request(meeting_id, user_id, request_sequence):
                print(f"Skipping stale AI task before response generation for {meeting_id}/{user_id}")
                return

            verify_required = (
                context_mode in {"needs_clarification", "weak_evidence"}
                or not context_results
            )
            if verify_required:
                clarifying_questions = [
                    str(question).strip()
                    for question in (
                        intent_payload.get("clarifying_questions")
                        or intent_payload.get("must_ask_questions")
                        or []
                    )
                    if str(question).strip()
                ]
                if not clarifying_questions:
                    clarifying_questions = [
                        "Can you confirm the product universe and state context?",
                        "Can you share the exact policy/code reference that must be verified?",
                    ]

                preferred_docs = [
                    str(doc_type).strip()
                    for doc_type in (intent_payload.get("preferred_doc_types") or [])
                    if str(doc_type).strip()
                ]
                missing_doc_category = ", ".join(preferred_docs[:2]) if preferred_docs else "regulatory guidance"

                verify_message = (
                    "Need to verify before answering.\n"
                    f"- Clarifying question 1: {clarifying_questions[0]}\n"
                    f"- Clarifying question 2: {clarifying_questions[1] if len(clarifying_questions) > 1 else clarifying_questions[0]}\n"
                    f"- Missing document category: {missing_doc_category}"
                )

                latency_fields = self._build_ai_latency_fields(metadata)
                self._record_ai_latency_metrics(latency_fields)

                await manager.broadcast_to_admin(meeting_id, {
                    "type": "ai-suggestion",
                    "suggestion": verify_message,
                    "relatedTo": text,
                    "citations": citations,
                    "contextSourceMode": context_mode or "unverified",
                    "evidenceConfidence": evidence_confidence,
                    **latency_fields,
                })
                if not is_draft_request:
                    self.save_transcript_to_db(meeting_id, "ai_assistant", verify_message, "ai")

                rag_audit_logger.log_event({
                    "sessionId": meeting_id,
                    "requestId": metadata.get("requestId"),
                    "requestOrigin": metadata.get("requestOrigin"),
                    "router": intent_payload,
                    "filters": retrieval_filter,
                    "retrievedChunkIds": [c.get("chunkId") for c in citations],
                    "retrievedScores": [c.get("score") for c in citations],
                    "citationsShown": citations,
                    "finalAnswerShown": verify_message,
                    "agentDisposition": metadata.get("agentDisposition"),
                    "contextSourceMode": context_mode,
                    "evidenceConfidence": evidence_confidence,
                })
                return

            retrieved_context = "\n\n".join(context_results[:6])

            system_prompt = """
            You are a compliance-first AI insurance assistant.
            Return output using EXACT sections:
            1) Read-back
            2) Ask next
            3) Internal Do/Don't
            4) Citations
            5) Escalate if

            RULES:
            - Keep guidance short, specific, and compliant.
            - Do not invent facts beyond provided evidence.
            - If uncertain, ask to verify and escalate.
            - Do not include customer PII.
            """

            user_prompt = f"""
            Context from Knowledge Base:
            {retrieved_context}

            Context quality mode: {context_mode}
            - verified: strong retrieval matches
            - fallback: weaker retrieval matches
            - unverified: no vector matches (general guidance only)
            - weak_evidence: retrieval exists but confidence is below threshold

            Intent:
            {intent_payload.get("intent_id")} (confidence={intent_confidence:.2f})

            Customer just said (redacted): "{redacted_text}"

            Provide the final agent-assist response now. Do NOT include disclaimers — they are appended separately.
            """

            model = genai.GenerativeModel(self.ai_model_name)
            full_prompt = system_prompt + user_prompt
            suggestion = ""
            # Stable stream key so the frontend updates the same suggestion entry
            stream_turn_id = str(metadata.get("turnId") or f"ai-{int(time.time() * 1000)}")
            stream_stage = "final"
            # Minimum accumulated chars before each interim broadcast (~40 chars ≈ 1-2 sentences)
            _STREAM_CHUNK_MIN = 40

            try:
                accumulated = ""
                last_broadcast_len = 0
                stream_resp = await model.generate_content_async(full_prompt, stream=True)
                async for chunk in stream_resp:
                    delta = chunk.text or ""
                    accumulated += delta
                    if len(accumulated) - last_broadcast_len >= _STREAM_CHUNK_MIN:
                        if self._is_latest_ai_request(meeting_id, user_id, request_sequence):
                            await manager.broadcast_to_admin(meeting_id, {
                                "type": "ai-suggestion",
                                "suggestion": accumulated,
                                "relatedTo": text,
                                "citations": citations,
                                "contextSourceMode": context_mode,
                                "evidenceConfidence": evidence_confidence,
                                "transcriptStage": stream_stage,
                                "turnId": stream_turn_id,
                                "streaming": True,
                            })
                        last_broadcast_len = len(accumulated)

                suggestion = accumulated.strip() or "I need a moment to verify the correct guidance before responding."
                gemini_usage_tracker.record_response(
                    operation="meeting_ai_suggestion",
                    response_payload=stream_resp,
                    request_text=full_prompt,
                )

            except Exception as stream_err:
                print(f"Gemini streaming failed, falling back to non-streaming: {stream_err}")
                response = await model.generate_content_async(full_prompt)
                gemini_usage_tracker.record_response(
                    operation="meeting_ai_suggestion",
                    response_payload=response,
                    request_text=full_prompt,
                )
                suggestion = (response.text or "").strip() or "I need a moment to verify the correct guidance before responding."

            if not self._is_latest_ai_request(meeting_id, user_id, request_sequence):
                print(f"Skipping stale AI suggestion for {meeting_id}/{user_id}")
                return

            # Phase 3A: Append deterministic disclaimer texts (post-processing, not LLM-generated)
            disclaimer_texts = self._resolve_disclaimers(
                intent_payload.get("required_disclaimers") or []
            )
            if disclaimer_texts:
                suggestion = suggestion + "\n\n---\n**Required Disclosures:**\n" + "\n".join(
                    f"- {d}" for d in disclaimer_texts
                )

            latency_fields = self._build_ai_latency_fields(metadata)
            self._record_ai_latency_metrics(latency_fields)

            # Final broadcast — complete text + citations
            await manager.broadcast_to_admin(meeting_id, {
                "type": "ai-suggestion",
                "suggestion": suggestion,
                "relatedTo": text,
                "citations": citations,
                "contextSourceMode": context_mode,
                "evidenceConfidence": evidence_confidence,
                "transcriptStage": stream_stage,
                "turnId": stream_turn_id,
                **latency_fields,
            })

            if not is_draft_request:
                self.save_transcript_to_db(meeting_id, "ai_assistant", suggestion, "ai")

            rag_audit_logger.log_event({
                "sessionId": meeting_id,
                "requestId": metadata.get("requestId"),
                "requestOrigin": metadata.get("requestOrigin"),
                "router": intent_payload,
                "filters": retrieval_filter,
                "filterStageUsed": active_filter_label,
                "retrievedChunkIds": [c.get("chunkId") for c in citations],
                "retrievedScores": [c.get("score") for c in citations],
                "citationsShown": citations,
                "finalAnswerShown": suggestion,
                "agentDisposition": metadata.get("agentDisposition"),
                "contextSourceMode": context_mode,
                "evidenceConfidence": evidence_confidence,
            })

        except asyncio.CancelledError:
            print(f"AI suggestion task cancelled for {meeting_id}/{user_id}")
            return
        except Exception as e:
            gemini_usage_tracker.record_error("meeting_ai_suggestion", e)
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

