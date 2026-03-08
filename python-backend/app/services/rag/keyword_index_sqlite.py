"""
SQLite FTS5 keyword index — Phase 3C replacement for the O(n) JSON BM25 scan.

Drop-in replacement for KeywordIndexService with the same public interface:
  - upsert_chunks(chunks)
  - search(query, top_k, filter_payload) -> List[Dict]

FTS5 provides:
  - Sub-millisecond full-text search at 100k+ chunks
  - Built-in BM25 ranking via the bm25() function
  - Porter-stemmer tokenizer for better recall
  - Metadata filtering via a companion table joined at query time
"""

import json
import os
import re
import sqlite3
from typing import Any, Dict, List, Optional


_DEFAULT_DB_PATH = os.path.join(os.path.dirname(__file__), "keyword_index.db")


class SQLiteKeywordIndexService:
    def __init__(self, db_path: str = _DEFAULT_DB_PATH):
        self.db_path = db_path
        self._conn: Optional[sqlite3.Connection] = None
        self._init_db()

    def _connect(self) -> sqlite3.Connection:
        if self._conn is None:
            self._conn = sqlite3.connect(self.db_path, check_same_thread=False)
            self._conn.row_factory = sqlite3.Row
        return self._conn

    def _init_db(self) -> None:
        conn = self._connect()
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS chunk_meta (
                chunk_id   TEXT PRIMARY KEY,
                meta_json  TEXT NOT NULL
            );

            CREATE VIRTUAL TABLE IF NOT EXISTS chunk_fts USING fts5(
                chunk_id UNINDEXED,
                content,
                tokenize = 'porter unicode61'
            );

            -- Phase 4B: Playbook dependency tracking
            -- Tracks which source docs each playbook chunk cites, and their etag at ingestion.
            -- When a cited doc changes, the playbook is flagged "Needs review".
            CREATE TABLE IF NOT EXISTS playbook_deps (
                playbook_chunk_id  TEXT NOT NULL,
                cited_doc_id       TEXT NOT NULL,
                cited_doc_etag     TEXT NOT NULL DEFAULT '',
                needs_review       INTEGER NOT NULL DEFAULT 0,
                updated_at         TEXT NOT NULL DEFAULT (datetime('now')),
                PRIMARY KEY (playbook_chunk_id, cited_doc_id)
            );
            CREATE INDEX IF NOT EXISTS idx_playbook_deps_cited
                ON playbook_deps (cited_doc_id);
        """)
        conn.commit()

    def upsert_chunks(self, chunks: List[Dict[str, Any]]) -> None:
        conn = self._connect()
        for chunk in chunks:
            chunk_id = str(chunk.get("chunk_id") or "").strip()
            text = str(chunk.get("text") or "").strip()
            metadata = chunk.get("metadata") or {}
            if not chunk_id or not text:
                continue
            meta_json = json.dumps(metadata, ensure_ascii=False)
            # Upsert metadata table
            conn.execute(
                "INSERT OR REPLACE INTO chunk_meta (chunk_id, meta_json) VALUES (?, ?)",
                (chunk_id, meta_json),
            )
            # Remove old FTS entry then insert fresh (FTS5 has no native UPSERT)
            conn.execute("DELETE FROM chunk_fts WHERE chunk_id = ?", (chunk_id,))
            conn.execute(
                "INSERT INTO chunk_fts (chunk_id, content) VALUES (?, ?)",
                (chunk_id, text),
            )
        conn.commit()

    def delete_by_doc_id(self, doc_id: str) -> None:
        conn = self._connect()
        rows = conn.execute(
            "SELECT chunk_id FROM chunk_meta WHERE json_extract(meta_json, '$.doc_id') = ?",
            (doc_id,),
        ).fetchall()
        for row in rows:
            cid = row["chunk_id"]
            conn.execute("DELETE FROM chunk_fts WHERE chunk_id = ?", (cid,))
            conn.execute("DELETE FROM chunk_meta WHERE chunk_id = ?", (cid,))
        conn.commit()

    def _match_filter_clause(self, candidate: Any, clause: Any) -> bool:
        if isinstance(clause, dict):
            if "$eq" in clause:
                return str(candidate) == str(clause["$eq"])
            if "$in" in clause:
                return str(candidate) in {str(v) for v in (clause["$in"] or [])}
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
            elif not self._match_filter_clause(candidate, clause):
                return False
        return True

    def search(
        self,
        query: str,
        top_k: int = 30,
        filter_payload: Optional[Dict[str, Any]] = None,
    ) -> List[Dict[str, Any]]:
        if not query or not query.strip():
            return []

        # Escape FTS5 special chars and build query string
        safe_query = re.sub(r'["\'\(\)\*\+\-\^]', " ", query).strip()
        if not safe_query:
            return []

        conn = self._connect()
        # Fetch top candidates from FTS5 (over-fetch to allow metadata filtering)
        fetch_k = max(top_k * 6, 200)
        try:
            rows = conn.execute(
                """
                SELECT f.chunk_id,
                       f.content,
                       m.meta_json,
                       bm25(chunk_fts) AS bm25_score
                FROM   chunk_fts  f
                JOIN   chunk_meta m ON m.chunk_id = f.chunk_id
                WHERE  chunk_fts MATCH ?
                ORDER  BY bm25_score
                LIMIT  ?
                """,
                (safe_query, fetch_k),
            ).fetchall()
        except sqlite3.OperationalError:
            # FTS query syntax error — fall back to empty
            return []

        results: List[Dict[str, Any]] = []
        for row in rows:
            try:
                metadata = json.loads(row["meta_json"])
            except Exception:
                metadata = {}
            if not self._matches_filter(metadata, filter_payload or {}):
                continue
            # bm25() returns negative values; negate for ascending relevance
            score = float(-row["bm25_score"])
            results.append({
                "chunk_id": row["chunk_id"],
                "text": row["content"],
                "score": score,
                "metadata": metadata,
                "source": metadata.get("source") or metadata.get("filename") or "unknown",
                "namespace": metadata.get("namespace") or "unknown",
            })
            if len(results) >= top_k:
                break

        return results

    def register_playbook_deps(
        self,
        playbook_chunk_id: str,
        cited_doc_ids: List[str],
        cited_doc_etag: str = "",
    ) -> None:
        """Record which source docs a playbook chunk cites (Phase 4B)."""
        if not playbook_chunk_id or not cited_doc_ids:
            return
        conn = self._connect()
        for doc_id in cited_doc_ids:
            conn.execute(
                """
                INSERT INTO playbook_deps (playbook_chunk_id, cited_doc_id, cited_doc_etag, needs_review, updated_at)
                VALUES (?, ?, ?, 0, datetime('now'))
                ON CONFLICT (playbook_chunk_id, cited_doc_id) DO UPDATE SET
                    cited_doc_etag = excluded.cited_doc_etag,
                    updated_at     = excluded.updated_at
                """,
                (playbook_chunk_id, doc_id, cited_doc_etag),
            )
        conn.commit()

    def flag_stale_playbooks(self, updated_doc_ids: List[str]) -> List[str]:
        """Mark playbooks that cite any of the updated docs as 'Needs review' (Phase 4B).

        Returns the list of affected playbook_chunk_ids.
        """
        if not updated_doc_ids:
            return []
        conn = self._connect()
        placeholders = ",".join("?" * len(updated_doc_ids))
        conn.execute(
            f"""
            UPDATE playbook_deps
            SET needs_review = 1, updated_at = datetime('now')
            WHERE cited_doc_id IN ({placeholders})
            """,
            updated_doc_ids,
        )
        conn.commit()
        rows = conn.execute(
            f"""
            SELECT DISTINCT playbook_chunk_id
            FROM playbook_deps
            WHERE cited_doc_id IN ({placeholders}) AND needs_review = 1
            """,
            updated_doc_ids,
        ).fetchall()
        stale = [row["playbook_chunk_id"] for row in rows]
        if stale:
            print(f"[4B] {len(stale)} playbook chunks need review after source doc update")
        return stale

    def get_playbooks_needing_review(self) -> List[Dict[str, Any]]:
        """Return all playbook chunks currently flagged for review."""
        conn = self._connect()
        rows = conn.execute(
            """
            SELECT playbook_chunk_id, cited_doc_id, cited_doc_etag, updated_at
            FROM playbook_deps
            WHERE needs_review = 1
            ORDER BY updated_at DESC
            """
        ).fetchall()
        return [dict(row) for row in rows]

    def clear_playbook_review_flag(self, playbook_chunk_id: str) -> None:
        """Clear the 'Needs review' flag once a playbook has been updated."""
        conn = self._connect()
        conn.execute(
            "UPDATE playbook_deps SET needs_review = 0 WHERE playbook_chunk_id = ?",
            (playbook_chunk_id,),
        )
        conn.commit()

    def close(self) -> None:
        if self._conn:
            self._conn.close()
            self._conn = None


sqlite_keyword_index_service = SQLiteKeywordIndexService()
