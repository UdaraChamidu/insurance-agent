import hashlib
from typing import Any, Dict, List, Optional

import os

from app.services.integrations.pinecone import pinecone_service
from app.services.llm.embeddings import embedding_service
from app.services.rag.chunking import chunking_service
from app.services.rag.processors import document_processor

_KEYWORD_BACKEND = os.getenv("KEYWORD_INDEX_BACKEND", "sqlite").lower()
if _KEYWORD_BACKEND == "sqlite":
    from app.services.rag.keyword_index_sqlite import sqlite_keyword_index_service as keyword_index_service
else:
    from app.services.rag.keyword_index import keyword_index_service


class IngestionOrchestrator:
    def __init__(self):
        pass

    def _sanitize_metadata_value(self, value: Any) -> Any:
        if value is None:
            return ""
        if isinstance(value, (str, int, float, bool)):
            return value
        if isinstance(value, list):
            sanitized_list: List[str] = []
            for item in value:
                if item is None:
                    continue
                sanitized_list.append(str(item))
            return sanitized_list
        return str(value)

    def _stable_chunk_id(self, doc_id: str, chunk_metadata: Dict[str, Any]) -> str:
        section_path = str(chunk_metadata.get("section_path") or "General")
        page_start = str(chunk_metadata.get("page_start") or "")
        chunk_index = str(chunk_metadata.get("chunk_index") or 0)
        content_hash = str(chunk_metadata.get("content_hash") or "")
        raw = f"{doc_id}|{section_path}|{page_start}|{chunk_index}|{content_hash[:16]}"
        return hashlib.sha1(raw.encode("utf-8", errors="ignore")).hexdigest()

    def _normalize_doc_type(self, filename: str, file_metadata: Dict[str, Any]) -> str:
        explicit = str(file_metadata.get("docType") or file_metadata.get("DocType") or "").strip()
        if explicit:
            return explicit

        lower = filename.lower()
        if lower.endswith(".pdf"):
            return "Regulation"
        if lower.endswith(".docx"):
            return "Manual"
        if lower.endswith(".md"):
            return "Playbook"
        if lower.endswith(".csv") or lower.endswith(".xlsx") or lower.endswith(".xls"):
            return "Checklist"
        return "Training"

    def _normalize_topic_tags(self, raw_tags: Any) -> List[str]:
        if isinstance(raw_tags, list):
            return [str(tag).strip() for tag in raw_tags if str(tag).strip()]
        if isinstance(raw_tags, str):
            return [piece.strip() for piece in raw_tags.split(",") if piece.strip()]
        return []

    def _normalize_base_metadata(
        self,
        filename: str,
        folder_name: str,
        namespace: str,
        file_id: Optional[str],
        file_metadata: Dict[str, Any],
        sharepoint_url: Optional[str],
        last_modified: Optional[str],
    ) -> Dict[str, Any]:
        doc_id = str(file_id or filename)
        topic_tags = self._normalize_topic_tags(file_metadata.get("topicTags"))
        citation_prefix = str(file_metadata.get("citationPrefix") or "").strip()
        doc_version = str(file_metadata.get("docVersion") or "").strip()
        state = str(file_metadata.get("state") or "FL").strip() or "FL"

        return {
            "doc_id": doc_id,
            "document_id": doc_id,
            "source": filename,
            "source_title": filename,
            "filename": filename,
            "folder_name": folder_name,
            "namespace": namespace,
            "sharepoint_url": str(sharepoint_url or ""),
            "last_modified": str(last_modified or ""),
            "state": state,
            "product_universe": str(file_metadata.get("productUniverse") or "").strip(),
            "regulator": str(file_metadata.get("regulator") or "").strip(),
            "authority_level": str(file_metadata.get("authorityLevel") or "").strip(),
            "doc_type": self._normalize_doc_type(filename, file_metadata),
            "carrier": str(file_metadata.get("carrier") or "").strip(),
            "effective_date": str(file_metadata.get("effectiveDate") or "").strip(),
            "doc_version": doc_version,
            "citation_prefix": citation_prefix,
            "process_stage": str(
                file_metadata.get("processStage")
                or file_metadata.get("process_stage")
                or ""
            ).strip(),
            "topic_tags": topic_tags,
        }

    async def _extract_text(self, content: bytes, filename: str) -> str:
        lower = filename.lower()
        if lower.endswith(".txt"):
            return document_processor.process_txt(content)
        if lower.endswith(".md"):
            return document_processor.process_md(content)
        if lower.endswith(".csv"):
            return document_processor.process_csv(content)
        if lower.endswith(".pdf"):
            return await document_processor.process_pdf(content)
        if lower.endswith(".docx"):
            return await document_processor.process_docx(content)
        if lower.endswith(".xlsx"):
            return await document_processor.process_xlsx(content)
        return ""

    async def process_file_content(
        self,
        content: bytes,
        filename: str,
        folder_name: str,
        namespace: str,
        file_id: Optional[str] = None,
        file_metadata: Optional[Dict[str, Any]] = None,
        sharepoint_url: Optional[str] = None,
        last_modified: Optional[str] = None,
    ):
        """
        Full RAG Pipeline: Extract -> Chunk -> Embed -> Upsert (+ keyword index).
        """
        print(f"Processing {filename} for namespace {namespace}...")
        normalized_file_metadata = file_metadata or {}

        text = await self._extract_text(content, filename)
        if not text.strip():
            print(f"Unsupported or empty file type/content: {filename}")
            return 0, 0

        base_metadata = self._normalize_base_metadata(
            filename=filename,
            folder_name=folder_name,
            namespace=namespace,
            file_id=file_id,
            file_metadata=normalized_file_metadata,
            sharepoint_url=sharepoint_url,
            last_modified=last_modified,
        )

        # Phase 3D: Enforce LIVE_ASSIST vs TRAINING KB separation.
        # Documents tagged TrainingReference must never enter the live-assist index.
        authority_level = str(base_metadata.get("authority_level") or "").strip()
        if authority_level == "TrainingReference":
            namespace = "training-reference"
            base_metadata["namespace"] = namespace
            print(f"[3D] TrainingReference doc '{filename}' → forced to training-reference namespace")

        chunks = chunking_service.chunk_text(text, metadata=base_metadata)
        if not chunks:
            print("No text extracted to chunk.")
            return 0, 0

        doc_id = str(base_metadata.get("doc_id") or filename)
        try:
            pinecone_service.delete_by_filter(
                namespace=namespace,
                filter_payload={"doc_id": {"$eq": doc_id}},
            )
        except Exception as delete_error:
            print(f"Pinecone pre-delete skipped for doc {doc_id}: {delete_error}")

        texts = [c["text"] for c in chunks]
        embeddings = await embedding_service.generate_embeddings_batch(texts)

        vectors = []
        keyword_chunks: List[Dict[str, Any]] = []
        for i, chunk in enumerate(chunks):
            if i >= len(embeddings) or not embeddings[i]:
                continue

            chunk_metadata = dict(chunk.get("metadata") or {})
            chunk_id = self._stable_chunk_id(doc_id, chunk_metadata)
            chunk_metadata["chunk_id"] = chunk_id

            safe_metadata = {
                key: self._sanitize_metadata_value(val)
                for key, val in chunk_metadata.items()
            }
            safe_metadata["text"] = chunk["text"]
            safe_metadata["chunk_text"] = chunk["text"]

            vectors.append({
                "id": chunk_id,
                "values": embeddings[i],
                "metadata": safe_metadata,
            })
            keyword_chunks.append({
                "chunk_id": chunk_id,
                "text": chunk["text"],
                "metadata": safe_metadata,
            })

        if not vectors:
            return len(chunks), 0

        success = pinecone_service.upsert(vectors, namespace)
        if not success:
            print("Failed to upsert to Pinecone.")
            return len(chunks), 0

        try:
            keyword_index_service.upsert_chunks(keyword_chunks)
        except Exception as keyword_error:
            print(f"Keyword index update failed for {filename}: {keyword_error}")

        # Phase 4B: Register playbook dependency links so stale playbooks can be detected
        # when a cited source doc is re-synced with a new etag.
        doc_type = str(base_metadata.get("doc_type") or "").strip()
        if doc_type == "Playbook" and _KEYWORD_BACKEND == "sqlite":
            cited_doc_ids = [
                str(v).strip()
                for v in (normalized_file_metadata.get("citedDocIds") or [])
                if str(v).strip()
            ]
            doc_etag = str(
                normalized_file_metadata.get("etag")
                or base_metadata.get("doc_version")
                or ""
            ).strip()
            if cited_doc_ids:
                try:
                    for kc in keyword_chunks:
                        keyword_index_service.register_playbook_deps(
                            playbook_chunk_id=kc["chunk_id"],
                            cited_doc_ids=cited_doc_ids,
                            cited_doc_etag=doc_etag,
                        )
                except Exception as dep_err:
                    print(f"Playbook dep registration failed for {filename}: {dep_err}")

        print(f"Successfully upserted {len(vectors)} chunks to Pinecone.")
        return len(chunks), len(vectors)


ingestion_orchestrator = IngestionOrchestrator()
