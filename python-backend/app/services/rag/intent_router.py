import json
import os
import re
from typing import Any, Dict, List


class IntentRouter:
    def __init__(self, cards_file: str = "intent_cards.json"):
        self.cards_path = os.path.join(os.path.dirname(__file__), cards_file)
        self.cards = self._load_cards()

    def _load_cards(self) -> List[Dict[str, Any]]:
        if not os.path.exists(self.cards_path):
            return []
        try:
            with open(self.cards_path, "r", encoding="utf-8") as file_obj:
                payload = json.load(file_obj)
                if isinstance(payload, list):
                    return [item for item in payload if isinstance(item, dict)]
        except Exception as load_error:
            print(f"Intent cards load error: {load_error}")
        return []

    def _tokenize(self, text: str) -> List[str]:
        return re.findall(r"[a-z0-9\-]+", (text or "").lower())

    def _normalize(self, text: str) -> str:
        return " ".join((text or "").strip().lower().split())

    def _build_clarifying_questions(self, query: str) -> List[str]:
        _ = query  # Keeps method signature explicit for future context-aware rules.
        return [
            "Can you confirm which product line this question is about (ACA, Medicare, Medigap, etc.)?",
            "Can you share the exact state and compliance context for this question?",
        ]

    def route(self, query: str) -> Dict[str, Any]:
        normalized_query = self._normalize(query)
        query_tokens = set(self._tokenize(query))
        if not normalized_query or not self.cards:
            return {
                "intent_id": "UNKNOWN",
                "confidence": 0.0,
                "clarifying_questions": self._build_clarifying_questions(query),
                "product_universe": "General",
                "primary_regulators": [],
                "preferred_doc_types": [],
                "required_disclaimers": [],
                "must_ask_questions": [],
                "escalation_triggers": [],
                "top_candidates": [],
            }

        scored: List[Dict[str, Any]] = []
        for card in self.cards:
            keywords = card.get("keywords") or []
            score = 0.0
            max_score = 0.0
            for keyword in keywords:
                token = self._normalize(str(keyword))
                if not token:
                    continue
                weight = 1.0 + (0.35 if "-" in token or any(ch.isdigit() for ch in token) else 0.0)
                max_score += weight
                if token in normalized_query:
                    score += weight
                elif token in query_tokens:
                    score += weight * 0.6

            # Domain-specific exact code boost.
            exact_code_tokens = {"1095-a", "aptc", "csr", "sep", "aep", "oep", "42", "cfr"}
            score += 0.4 * len(query_tokens.intersection(exact_code_tokens))
            max_score += 0.4 * len(exact_code_tokens.intersection(set(k.lower() for k in keywords)))

            # Cap denominator at 5.0 so larger keyword lists don't dilute confidence.
            # Matching ~5 weighted keywords = full confidence.
            confidence = min(1.0, score / max(min(max_score, 5.0), 1.0))
            scored.append({
                "card": card,
                "score": score,
                "confidence": max(0.0, min(1.0, confidence)),
            })

        scored.sort(key=lambda item: (item["score"], item["confidence"]), reverse=True)
        best = scored[0] if scored else None
        top_candidates = [
            {
                "intent_id": str(item["card"].get("intent_id") or "UNKNOWN"),
                "confidence": float(item["confidence"]),
            }
            for item in scored[:3]
        ]

        if not best or best["confidence"] < 0.22:
            return {
                "intent_id": "UNKNOWN",
                "confidence": float(best["confidence"]) if best else 0.0,
                "clarifying_questions": self._build_clarifying_questions(query),
                "product_universe": "General",
                "primary_regulators": [],
                "preferred_doc_types": [],
                "required_disclaimers": [],
                "must_ask_questions": [],
                "escalation_triggers": [],
                "top_candidates": top_candidates,
            }

        card = best["card"]
        return {
            "intent_id": str(card.get("intent_id") or "UNKNOWN"),
            "confidence": float(best["confidence"]),
            "clarifying_questions": [],
            "product_universe": str(card.get("product_universe") or "General"),
            "primary_regulators": [str(v) for v in (card.get("primary_regulators") or []) if str(v).strip()],
            "preferred_doc_types": [str(v) for v in (card.get("preferred_doc_types") or []) if str(v).strip()],
            "required_disclaimers": [str(v) for v in (card.get("required_disclaimers") or []) if str(v).strip()],
            "must_ask_questions": [str(v) for v in (card.get("must_ask_questions") or []) if str(v).strip()],
            "escalation_triggers": [str(v) for v in (card.get("escalation_triggers") or []) if str(v).strip()],
            "top_candidates": top_candidates,
        }


intent_router = IntentRouter()

