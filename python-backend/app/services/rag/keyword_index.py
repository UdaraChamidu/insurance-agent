import json
import math
import os
import re
from collections import Counter
from typing import Any, Dict, List


class KeywordIndexService:
    def __init__(self, storage_file: str = "keyword_index_state.json"):
        self.storage_file = storage_file
        self.state = self._load_state()

    def _load_state(self) -> Dict[str, Any]:
        if os.path.exists(self.storage_file):
            try:
                with open(self.storage_file, "r", encoding="utf-8") as file_obj:
                    data = json.load(file_obj)
                    if isinstance(data, dict):
                        return data
            except Exception as load_error:
                print(f"Keyword index load error: {load_error}")
        return {"chunks": {}}

    def _save_state(self) -> None:
        try:
            with open(self.storage_file, "w", encoding="utf-8") as file_obj:
                json.dump(self.state, file_obj, indent=2, ensure_ascii=False)
        except Exception as save_error:
            print(f"Keyword index save error: {save_error}")

    def _tokenize(self, text: str) -> List[str]:
        return re.findall(r"[a-z0-9\-]+", (text or "").lower())

    def upsert_chunks(self, chunks: List[Dict[str, Any]]) -> None:
        chunk_map = self.state.setdefault("chunks", {})
        for chunk in chunks:
            chunk_id = str(chunk.get("chunk_id") or "").strip()
            chunk_text = str(chunk.get("text") or "").strip()
            if not chunk_id or not chunk_text:
                continue
            metadata = chunk.get("metadata") or {}
            chunk_map[chunk_id] = {
                "text": chunk_text,
                "metadata": metadata,
            }
        self._save_state()

    def _match_filter_clause(self, candidate: Any, clause: Any) -> bool:
        if isinstance(clause, dict):
            if "$eq" in clause:
                return str(candidate) == str(clause.get("$eq"))
            if "$in" in clause:
                values = clause.get("$in") or []
                return str(candidate) in {str(item) for item in values}
            return False
        return str(candidate) == str(clause)

    def _matches_filter(self, metadata: Dict[str, Any], filter_payload: Dict[str, Any]) -> bool:
        if not filter_payload:
            return True
        for field, clause in filter_payload.items():
            candidate = metadata.get(field)
            if isinstance(candidate, list):
                if not any(self._match_filter_clause(item, clause) for item in candidate):
                    return False
                continue
            if not self._match_filter_clause(candidate, clause):
                return False
        return True

    def search(self, query: str, top_k: int = 30, filter_payload: Dict[str, Any] | None = None) -> List[Dict[str, Any]]:
        query_tokens = self._tokenize(query)
        if not query_tokens:
            return []

        chunk_map = self.state.get("chunks") or {}
        if not isinstance(chunk_map, dict) or not chunk_map:
            return []

        candidates: List[Dict[str, Any]] = []
        documents: List[List[str]] = []
        for chunk_id, payload in chunk_map.items():
            if not isinstance(payload, dict):
                continue
            metadata = payload.get("metadata") or {}
            if not self._matches_filter(metadata, filter_payload or {}):
                continue
            text = str(payload.get("text") or "")
            tokens = self._tokenize(text)
            if not tokens:
                continue
            documents.append(tokens)
            candidates.append({
                "chunk_id": chunk_id,
                "text": text,
                "tokens": tokens,
                "metadata": metadata,
            })

        if not candidates:
            return []

        # BM25-like score.
        k1 = 1.2
        b = 0.75
        avgdl = max(1.0, sum(len(doc) for doc in documents) / len(documents))
        doc_freq: Dict[str, int] = {}
        query_terms = set(query_tokens)
        for term in query_terms:
            doc_freq[term] = sum(1 for doc in documents if term in set(doc))

        scored: List[Dict[str, Any]] = []
        total_docs = len(documents)
        for entry in candidates:
            token_counts = Counter(entry["tokens"])
            doc_len = len(entry["tokens"])
            score = 0.0
            for term in query_terms:
                tf = token_counts.get(term, 0)
                if tf <= 0:
                    continue
                df = max(1, doc_freq.get(term, 0))
                idf = math.log(1 + ((total_docs - df + 0.5) / (df + 0.5)))
                numerator = tf * (k1 + 1)
                denominator = tf + k1 * (1 - b + b * (doc_len / avgdl))
                score += idf * (numerator / max(denominator, 1e-9))

            if score <= 0:
                continue

            metadata = entry["metadata"]
            scored.append({
                "chunk_id": entry["chunk_id"],
                "text": entry["text"],
                "score": score,
                "metadata": metadata,
                "source": metadata.get("source") or metadata.get("filename") or "unknown",
                "namespace": metadata.get("namespace") or "unknown",
            })

        scored.sort(key=lambda item: item.get("score", 0.0), reverse=True)
        return scored[: max(1, top_k)]


keyword_index_service = KeywordIndexService()

