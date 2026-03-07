import asyncio
from typing import Any, Dict, List
from fastapi import APIRouter, HTTPException
from app.services.sharepoint_service import sharepoint_service
from app.services.document.ingestion_service import ingestion_service
from app.services.integrations.pinecone import pinecone_service
from pydantic import BaseModel, Field

router = APIRouter()

class ReprocessRequest(BaseModel):
    fileKey: str


class RagDebugRequest(BaseModel):
    query: str
    state: str = "FL"
    product_universe: str = ""
    regulator: str = ""
    process_stage: str = ""
    carrier: str = ""
    doc_type: str = ""
    namespaces: List[str] = Field(default_factory=list)
    top_k_per_namespace: int | None = None
    vector_top_k: int | None = None
    keyword_top_k: int | None = None
    return_top_k: int | None = None
    redact_query: bool = True
    include_metadata: bool = False


def _coerce_int(value: Any, default: int = 0) -> int:
    try:
        if value is None:
            return default
        return int(value)
    except (TypeError, ValueError):
        return default


def _to_mapping(value: Any) -> Dict[str, Any]:
    if isinstance(value, dict):
        return value
    if hasattr(value, "model_dump"):
        try:
            dumped = value.model_dump()
            if isinstance(dumped, dict):
                return dumped
        except Exception:
            pass
    if hasattr(value, "to_dict"):
        try:
            dumped = value.to_dict()
            if isinstance(dumped, dict):
                return dumped
        except Exception:
            pass
    if hasattr(value, "__dict__"):
        data = {
            key: val
            for key, val in vars(value).items()
            if not str(key).startswith("_")
        }
        if isinstance(data, dict):
            return data
    return {}


def _extract_total_vectors(stats_obj: Any) -> int:
    if isinstance(stats_obj, dict):
        for key in ("totalVectors", "totalRecordCount", "total_vector_count", "totalVectorCount"):
            if key in stats_obj:
                return _coerce_int(stats_obj.get(key), 0)
    for attr in ("totalVectors", "totalRecordCount", "total_vector_count", "totalVectorCount"):
        if hasattr(stats_obj, attr):
            return _coerce_int(getattr(stats_obj, attr), 0)
    return 0


def _extract_namespaces(stats_obj: Any) -> Dict[str, Dict[str, int]]:
    raw_namespaces: Any = {}
    if isinstance(stats_obj, dict):
        raw_namespaces = stats_obj.get("namespaces", {}) or {}
    elif hasattr(stats_obj, "namespaces"):
        raw_namespaces = getattr(stats_obj, "namespaces") or {}

    if not isinstance(raw_namespaces, dict):
        raw_namespaces = _to_mapping(raw_namespaces)

    normalized: Dict[str, Dict[str, int]] = {}
    for ns_name, raw_data in (raw_namespaces or {}).items():
        namespace_name = str(ns_name or "")
        mapping = _to_mapping(raw_data)
        record_count = 0
        if mapping:
            for key in ("recordCount", "vector_count", "vectorCount", "totalRecordCount"):
                if key in mapping:
                    record_count = _coerce_int(mapping.get(key), 0)
                    break
        if record_count == 0 and not mapping:
            for attr in ("recordCount", "vector_count", "vectorCount", "totalRecordCount"):
                if hasattr(raw_data, attr):
                    record_count = _coerce_int(getattr(raw_data, attr), 0)
                    break
        normalized[namespace_name] = {"recordCount": record_count}
    return normalized


def _safe_positive_int(value: Any, default: int) -> int:
    parsed = _coerce_int(value, default)
    return parsed if parsed > 0 else default


def _json_safe(value: Any) -> Any:
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, list):
        return [_json_safe(item) for item in value]
    if isinstance(value, dict):
        return {str(key): _json_safe(item) for key, item in value.items()}
    return str(value)


def _serialize_hit(hit: Dict[str, Any], include_metadata: bool = False) -> Dict[str, Any]:
    payload = {
        "chunkId": str(hit.get("chunk_id") or ""),
        "docId": str(hit.get("doc_id") or ""),
        "source": str(hit.get("source") or ""),
        "namespace": str(hit.get("namespace") or "unknown"),
        "score": float(hit.get("score") or 0.0),
        "vectorScore": float(hit.get("vector_score") or 0.0),
        "keywordScore": float(hit.get("keyword_score") or 0.0),
        "sectionPath": str(hit.get("section_path") or ""),
        "pageStart": hit.get("page_start"),
        "pageEnd": hit.get("page_end"),
        "docVersion": str(hit.get("doc_version") or ""),
        "effectiveDate": str(hit.get("effective_date") or ""),
        "citationPrefix": str(hit.get("citation_prefix") or ""),
        "regulator": str(hit.get("regulator") or ""),
        "authorityLevel": str(hit.get("authority_level") or ""),
        "processStage": str(hit.get("process_stage") or ""),
        "sharepointUrl": str(hit.get("sharepoint_url") or ""),
        "productUniverse": str(hit.get("product_universe") or ""),
        "text": str(hit.get("text") or ""),
    }
    if include_metadata:
        payload["metadata"] = _json_safe(hit.get("metadata") if isinstance(hit.get("metadata"), dict) else {})
    return payload

@router.get("/stats", response_model=Dict[str, Any])
async def get_document_stats():
    """
    Get statistics about the Knowledge Base (ingestion status + pinecone stats)
    """
    try:
        # 1. Get Ingestion Stats (from local tracker)
        ingestion_stat = ingestion_service.get_stats()
        
        # 2. Get Pinecone Stats (live) with schema normalization across SDK versions.
        pinecone_raw: Any = {"totalRecordCount": 0, "namespaces": {}}
        try:
            pinecone_raw = pinecone_service.get_stats()
        except Exception as e:
            print(f"Pinecone stats error: {e}")

        pinecone_namespaces = _extract_namespaces(pinecone_raw)
        pinecone_total = _extract_total_vectors(pinecone_raw)
        if pinecone_total <= 0 and pinecone_namespaces:
            pinecone_total = sum(
                _coerce_int(ns_data.get("recordCount"), 0)
                for ns_data in pinecone_namespaces.values()
            )

        return {
            "ingestion": ingestion_stat,
            "pinecone": {
                "totalVectors": pinecone_total,
                "namespaces": pinecone_namespaces
            }
        }
        
    except Exception as e:
        print(f"Stats Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/files", response_model=Dict[str, List[Dict[str, Any]]])
async def get_processed_files():
    """
    List all processed files
    """
    try:
        files = ingestion_service.get_processed_files()
        return {"files": files}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/rag-debug", response_model=Dict[str, Any])
async def rag_debug(request: RagDebugRequest):
    """
    Debug endpoint for RAG pipeline internals:
    router + filters + vector hits + keyword hits + fused ranking + citations.
    """
    query = str(request.query or "").strip()
    if not query:
        raise HTTPException(status_code=400, detail="query is required")

    try:
        from app.services.meeting.audio_service import audio_service
        from app.services.rag.intent_router import intent_router
        from app.services.rag.redaction import redaction_service

        context_flags = audio_service._extract_context_flags({
            "state": request.state,
            "product_universe": request.product_universe,
            "regulator": request.regulator,
            "process_stage": request.process_stage,
            "carrier": request.carrier,
            "doc_type": request.doc_type,
        })

        effective_query = redaction_service.redact(query) if request.redact_query else query
        intent_payload = intent_router.route(effective_query)
        retrieval_filter = audio_service._build_retrieval_filter(context_flags, intent_payload)

        requested_namespaces = [str(ns).strip() for ns in request.namespaces if str(ns).strip()]
        if requested_namespaces:
            namespaces = requested_namespaces
        else:
            target_universe = (
                context_flags.get("product_universe")
                or str(intent_payload.get("product_universe") or "").strip()
            )
            namespaces = audio_service._namespace_candidates_for_universe(target_universe)
            if not namespaces:
                namespaces = [ns for ns in audio_service.rag_namespaces if ns]

        top_k_per_namespace = _safe_positive_int(
            request.top_k_per_namespace,
            audio_service.rag_top_k_per_namespace,
        )
        vector_top_k = _safe_positive_int(request.vector_top_k, audio_service.rag_vector_top_k)
        keyword_top_k = _safe_positive_int(request.keyword_top_k, audio_service.rag_keyword_top_k)
        return_top_k = _safe_positive_int(request.return_top_k, audio_service.rag_return_top_k)

        embedding = await audio_service._generate_query_embedding(effective_query)

        raw_vector_hits: List[Dict[str, Any]] = []
        vector_hits: List[Dict[str, Any]] = []
        keyword_hits_raw: List[Dict[str, Any]] = []
        normalized_keyword_hits: List[Dict[str, Any]] = []
        fused_hits: List[Dict[str, Any]] = []
        ranked_hits: List[Dict[str, Any]] = []
        verified_hits: List[Dict[str, Any]] = []
        fallback_hits: List[Dict[str, Any]] = []
        selected_hits: List[Dict[str, Any]] = []
        context_mode = "embedding_unavailable"
        evidence_confidence = 0.0

        if embedding:
            raw_vector_hits, keyword_hits_raw = await asyncio.gather(
                audio_service._query_vector_hits_parallel(
                    embedding=embedding,
                    namespaces=namespaces,
                    top_k_per_namespace=top_k_per_namespace,
                    filter_payload=retrieval_filter,
                ),
                audio_service._query_keyword_hits(
                    query_text=effective_query,
                    top_k=keyword_top_k,
                    filter_payload=retrieval_filter,
                ),
            )
            normalized_keyword_hits = [
                audio_service._normalize_keyword_hit(hit)
                for hit in keyword_hits_raw
            ]

            vector_hits = audio_service._dedupe_rank_hits(
                raw_vector_hits,
                process_stage=context_flags.get("process_stage", ""),
            )[:vector_top_k]
            fused_hits = audio_service._fuse_hits(vector_hits, keyword_hits_raw, effective_query)
            ranked_hits = audio_service._dedupe_rank_hits(
                fused_hits,
                process_stage=context_flags.get("process_stage", ""),
            )
            ranked_hits = audio_service._rerank_hits(
                effective_query,
                ranked_hits,
                keep_top=max(40, return_top_k * 5),
            )

            verified_hits = [
                hit for hit in ranked_hits
                if float(hit.get("score", 0.0)) >= audio_service.rag_min_score
            ]
            fallback_hits = [
                hit for hit in ranked_hits
                if float(hit.get("score", 0.0)) >= audio_service.rag_fallback_min_score
            ]

            if verified_hits:
                selected_hits = verified_hits
                context_mode = "verified"
            elif fallback_hits:
                selected_hits = fallback_hits
                context_mode = "fallback"
            else:
                context_mode = "unverified"

            evidence_confidence = audio_service._compute_evidence_confidence(
                effective_query,
                selected_hits if selected_hits else ranked_hits,
            )
            if evidence_confidence < audio_service.rag_evidence_min_confidence:
                selected_hits = []
                context_mode = "weak_evidence"

            intent_needs_clarification = (
                intent_payload.get("intent_id") == "UNKNOWN"
                or float(intent_payload.get("confidence") or 0.0) < audio_service.rag_intent_min_confidence
            )
            if intent_needs_clarification and not selected_hits:
                context_mode = "needs_clarification"

        citations: List[Dict[str, Any]] = []
        for hit in selected_hits[:return_top_k]:
            source_text = str(hit.get("text") or "")
            citations.append({
                "chunkId": str(hit.get("chunk_id") or ""),
                "docId": str(hit.get("doc_id") or ""),
                "source": str(hit.get("source") or "Unknown Source"),
                "namespace": str(hit.get("namespace") or "unknown"),
                "score": float(hit.get("score", 0.0)),
                "sectionPath": str(hit.get("section_path") or "Unknown section"),
                "pageStart": hit.get("page_start"),
                "pageEnd": hit.get("page_end"),
                "docVersion": str(hit.get("doc_version") or "n/a"),
                "effectiveDate": str(hit.get("effective_date") or "n/a"),
                "citationPrefix": str(hit.get("citation_prefix") or ""),
                "regulator": str(hit.get("regulator") or ""),
                "authorityLevel": str(hit.get("authority_level") or ""),
                "sharepointUrl": str(hit.get("sharepoint_url") or ""),
                "text": (source_text[:120] + "...") if len(source_text) > 120 else source_text,
            })

        return {
            "query": {
                "original": query,
                "effective": effective_query,
                "redacted": bool(request.redact_query),
                "exactTokens": audio_service._extract_exact_tokens(effective_query),
            },
            "router": intent_payload,
            "contextFlags": context_flags,
            "retrieval": {
                "filter": retrieval_filter,
                "namespaces": namespaces,
                "topK": {
                    "perNamespaceVector": top_k_per_namespace,
                    "vector": vector_top_k,
                    "keyword": keyword_top_k,
                    "return": return_top_k,
                },
            },
            "vector": {
                "rawCount": len(raw_vector_hits),
                "rankedCount": len(vector_hits),
                "hits": [_serialize_hit(hit, request.include_metadata) for hit in vector_hits],
            },
            "keyword": {
                "rawCount": len(keyword_hits_raw),
                "hits": [_serialize_hit(hit, request.include_metadata) for hit in normalized_keyword_hits],
            },
            "fusion": {
                "fusedCount": len(fused_hits),
                "rankedCount": len(ranked_hits),
                "verifiedCount": len(verified_hits),
                "fallbackCount": len(fallback_hits),
                "selectedCount": len(selected_hits),
                "contextMode": context_mode,
                "evidenceConfidence": evidence_confidence,
                "hits": [_serialize_hit(hit, request.include_metadata) for hit in ranked_hits[:return_top_k]],
            },
            "citations": citations,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/reprocess", response_model=Dict[str, Any])
async def reprocess_file(request: ReprocessRequest):
    """
    Remove file from tracking so it gets picked up again by the ingester
    """
    try:
        removed_file = ingestion_service.reprocess_file(request.fileKey)
        if not removed_file:
            raise HTTPException(status_code=404, detail="File not found in tracking")

        namespace = str(removed_file.get("namespace") or "").strip()
        if namespace:
            try:
                pinecone_service.delete_by_filter(
                    namespace=namespace,
                    filter_payload={"doc_id": {"$eq": request.fileKey}},
                )
            except Exception as delete_error:
                print(f"Reprocess pre-delete skipped for {request.fileKey}: {delete_error}")
            
        # Trigger Notification
        from app.services.notification_service import notification_service
        # We can run this in background task if we inject it, but for now simple await or sync call if async allowed
        # notification_service is async for create_notification
        # We need to await it
        await notification_service.create_notification(
            type="file",
            title="File Reprocessing Started",
            message=f"Queueing {removed_file.get('fileName')} for re-ingestion",
            metadata={"fileKey": request.fileKey}
        )
            
        return {
             "success": True, 
             "fileName": removed_file.get("fileName"),
             "message": "File queued for re-processing"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/list", response_model=List[Dict[str, Any]])
async def list_documents(folder: str = "00_TrainingReference"):
    """
    List documents in a specific SharePoint folder (direct query)
    """
    try:
        return sharepoint_service.list_documents_in_folder(folder, "KB-DEV")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
