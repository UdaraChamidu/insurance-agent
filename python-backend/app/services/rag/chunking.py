import hashlib
import re
from typing import Dict, List


class ChunkingService:
    def __init__(self):
        # Citation-grade ranges from requirement docs.
        self.chunk_min_tokens = 350
        self.chunk_max_tokens = 900
        self.chunk_overlap_tokens = 80

    def _split_words(self, text: str) -> List[str]:
        return [w for w in re.split(r"\s+", (text or "").strip()) if w]

    def _is_upper_heading(self, line: str) -> bool:
        if not line or len(line) > 100:
            return False
        words = [w for w in re.split(r"\s+", line) if w]
        if len(words) < 2 or len(words) > 14:
            return False
        alpha_chars = [c for c in line if c.isalpha()]
        if len(alpha_chars) < 6:
            return False
        return line == line.upper()

    def _parse_heading(self, line: str) -> tuple[int, str] | None:
        markdown_match = re.match(r"^(#{1,6})\s+(.+)$", line)
        if markdown_match:
            return len(markdown_match.group(1)), markdown_match.group(2).strip()

        numeric_match = re.match(r"^(\d+(?:\.\d+)*)[\)\.]?\s+(.+)$", line)
        if numeric_match:
            depth = numeric_match.group(1).count(".") + 1
            heading = f"{numeric_match.group(1)} {numeric_match.group(2).strip()}"
            return min(depth, 6), heading

        if self._is_upper_heading(line):
            return 1, line.strip()

        return None

    def _build_structured_blocks(self, text: str) -> List[Dict[str, str]]:
        lines = (text or "").splitlines()
        section_stack: List[str] = []
        paragraph_lines: List[str] = []
        blocks: List[Dict[str, str]] = []

        def flush_paragraph() -> None:
            if not paragraph_lines:
                return
            paragraph = " ".join(part.strip() for part in paragraph_lines if part.strip()).strip()
            paragraph_lines.clear()
            if not paragraph:
                return
            section_path = " > ".join(section_stack) if section_stack else "General"
            blocks.append({
                "section_path": section_path,
                "text": paragraph,
            })

        for raw_line in lines:
            line = (raw_line or "").strip()
            if not line:
                flush_paragraph()
                continue

            heading_info = self._parse_heading(line)
            if heading_info:
                flush_paragraph()
                level, heading_text = heading_info
                level = max(1, min(level, 6))
                while len(section_stack) >= level:
                    section_stack.pop()
                section_stack.append(heading_text)
                continue

            paragraph_lines.append(line)

        flush_paragraph()
        return blocks

    def _build_section_chunks(self, section_text: str, max_tokens: int, overlap_tokens: int) -> List[str]:
        words = self._split_words(section_text)
        if not words:
            return []

        if len(words) <= max_tokens:
            return [" ".join(words)]

        step = max(1, max_tokens - overlap_tokens)
        chunks: List[str] = []
        start = 0
        total = len(words)
        while start < total:
            end = min(total, start + max_tokens)
            chunk_words = words[start:end]
            if chunk_words:
                chunks.append(" ".join(chunk_words))
            if end >= total:
                break
            start += step
        return chunks

    def chunk_text(self, text: str, metadata: dict | None = None) -> List[dict]:
        """
        Split text into structural, overlapping token chunks.
        Returns list of { "text": str, "metadata": dict }.
        """
        if not text:
            return []

        base_metadata = metadata.copy() if metadata else {}
        blocks = self._build_structured_blocks(text)
        if not blocks:
            blocks = [{"section_path": "General", "text": text}]

        # Merge contiguous blocks by section path so windows preserve section context.
        merged_sections: List[Dict[str, str]] = []
        for block in blocks:
            section_path = str(block.get("section_path") or "General")
            block_text = str(block.get("text") or "").strip()
            if not block_text:
                continue
            if merged_sections and merged_sections[-1]["section_path"] == section_path:
                merged_sections[-1]["text"] += "\n\n" + block_text
            else:
                merged_sections.append({"section_path": section_path, "text": block_text})

        chunks: List[dict] = []
        global_token_offset = 0
        for section in merged_sections:
            section_path = section["section_path"]
            section_chunks = self._build_section_chunks(
                section["text"],
                max_tokens=self.chunk_max_tokens,
                overlap_tokens=self.chunk_overlap_tokens,
            )
            for section_chunk_text in section_chunks:
                words = self._split_words(section_chunk_text)
                token_count = len(words)
                if token_count == 0:
                    continue

                chunk_metadata = base_metadata.copy()
                chunk_metadata["chunk_index"] = len(chunks)
                chunk_metadata["section_path"] = section_path
                chunk_metadata["page_start"] = None
                chunk_metadata["page_end"] = None
                chunk_metadata["token_start"] = global_token_offset
                chunk_metadata["token_end"] = global_token_offset + token_count
                chunk_metadata["content_hash"] = hashlib.sha1(
                    section_chunk_text.encode("utf-8", errors="ignore")
                ).hexdigest()

                chunks.append({
                    "text": section_chunk_text,
                    "metadata": chunk_metadata,
                })

                global_token_offset += token_count

        return chunks


chunking_service = ChunkingService()

