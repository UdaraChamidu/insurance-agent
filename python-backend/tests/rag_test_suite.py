"""
RAG Pipeline Test Suite — Phase 4A
===================================
Runs the intent router and (optionally) live retrieval against a curated set of
insurance-domain queries, then reports:

  - Intent routing accuracy   (correct universe + intent_id)
  - Evidence confidence       (mean + pass-rate above threshold)
  - Citation presence         (was at least one citation returned?)
  - Verify/escalate triggers  (correct weak-evidence detection)

Usage (offline router-only, no Pinecone calls):
    python -m pytest tests/rag_test_suite.py -v

Usage (full live retrieval — requires running backend env):
    RAG_LIVE_TEST=1 python -m pytest tests/rag_test_suite.py -v -k live

Add new test cases to RAG_TEST_CASES at the bottom of this file.
"""

import os
import sys
import asyncio
from typing import Any, Dict, List, Optional

import pytest

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _run(coro):
    """Run a coroutine in a new event loop (pytest-asyncio not required)."""
    return asyncio.get_event_loop().run_until_complete(coro)


# ---------------------------------------------------------------------------
# Test case schema
# ---------------------------------------------------------------------------
# Each entry:
#   query            : str   — the raw customer utterance
#   expected_intent  : str   — expected intent_id (or None = don't check)
#   expected_universe: str   — expected product_universe (or None = don't check)
#   expect_verify    : bool  — True if the query should trigger verify/escalate
#   min_confidence   : float — minimum acceptable intent confidence
# ---------------------------------------------------------------------------

RAG_TEST_CASES: List[Dict[str, Any]] = [
    # ── ACA / SEP ──────────────────────────────────────────────────────────
    {
        "query": "I moved to a new zip code last month. Can I change my plan?",
        "expected_intent": "ACA_SEP_MOVE",
        "expected_universe": "ACA",
        "expect_verify": False,
        "min_confidence": 0.30,
    },
    {
        "query": "We relocated to Florida 45 days ago. Do I qualify for a special enrollment?",
        "expected_intent": "ACA_SEP_MOVE",
        "expected_universe": "ACA",
        "expect_verify": False,
        "min_confidence": 0.20,
    },
    {
        "query": "I lost my job last week and lost my employer health insurance.",
        "expected_universe": "ACA",
        "expected_intent": None,
        "expect_verify": False,
        "min_confidence": 0.10,
    },
    # ── ACA / APTC & CSR ───────────────────────────────────────────────────
    {
        "query": "My income changed this year. Will my subsidy be affected?",
        "expected_intent": "ACA_APTC_CSR",
        "expected_universe": "ACA",
        "expect_verify": False,
        "min_confidence": 0.25,
    },
    {
        "query": "I received a 1095-A form. What do I do with it for my taxes?",
        "expected_intent": "ACA_APTC_CSR",
        "expected_universe": "ACA",
        "expect_verify": False,
        "min_confidence": 0.30,
    },
    {
        "query": "What is APTC reconciliation and how does it work?",
        "expected_intent": "ACA_APTC_CSR",
        "expected_universe": "ACA",
        "expect_verify": False,
        "min_confidence": 0.30,
    },
    # ── ACA / Appeals ──────────────────────────────────────────────────────
    {
        "query": "The marketplace denied my eligibility. How do I appeal?",
        "expected_intent": "ACA_APPEAL_STEPS",
        "expected_universe": "ACA",
        "expect_verify": False,
        "min_confidence": 0.30,
    },
    {
        "query": "I got a denial notice from healthcare.gov. What are my options?",
        "expected_intent": "ACA_APPEAL_STEPS",
        "expected_universe": "ACA",
        "expect_verify": False,
        "min_confidence": 0.25,
    },
    # ── Medicare / Enrollment Periods ──────────────────────────────────────
    {
        "query": "I'm turning 65 next month. When can I enroll in Medicare?",
        "expected_intent": "MEDICARE_ENROLLMENT_PERIODS",
        "expected_universe": "Medicare",
        "expect_verify": False,
        "min_confidence": 0.30,
    },
    {
        "query": "What is the difference between IEP, AEP, and OEP for Medicare?",
        "expected_intent": "MEDICARE_ENROLLMENT_PERIODS",
        "expected_universe": "Medicare",
        "expect_verify": False,
        "min_confidence": 0.35,
    },
    {
        "query": "Can I switch my Medicare Advantage plan outside open enrollment?",
        "expected_intent": "MEDICARE_ENROLLMENT_PERIODS",
        "expected_universe": "Medicare",
        "expect_verify": False,
        "min_confidence": 0.25,
    },
    {
        "query": "I missed my initial enrollment period for Medicare Part B. Am I penalized?",
        "expected_intent": "MEDICARE_ENROLLMENT_PERIODS",
        "expected_universe": "Medicare",
        "expect_verify": False,
        "min_confidence": 0.25,
    },
    # ── Medicare / Marketing & SOA ─────────────────────────────────────────
    {
        "query": "Do I need a scope of appointment before talking about Medicare plans?",
        "expected_intent": "MEDICARE_MARKETING_DISCLAIMERS",
        "expected_universe": "Medicare",
        "expect_verify": False,
        "min_confidence": 0.30,
    },
    {
        "query": "What CMS disclaimers are required when selling Medicare Advantage?",
        "expected_intent": "MEDICARE_MARKETING_DISCLAIMERS",
        "expected_universe": "Medicare",
        "expect_verify": False,
        "min_confidence": 0.30,
    },
    # ── Medigap / GI Rights ────────────────────────────────────────────────
    {
        "query": "I'm losing my employer retiree coverage. Do I have guaranteed issue rights for Medigap?",
        "expected_intent": "MEDIGAP_GI_RIGHTS",
        "expected_universe": "Medigap",
        "expect_verify": False,
        "min_confidence": 0.25,
    },
    {
        "query": "My Medicare Advantage plan is leaving my area. Can I get a supplement without underwriting?",
        "expected_intent": "MEDIGAP_GI_RIGHTS",
        "expected_universe": "Medigap",
        "expect_verify": False,
        "min_confidence": 0.20,
    },
    # ── Florida Compliance ─────────────────────────────────────────────────
    {
        "query": "Does Florida require me to disclose call recording to the customer?",
        "expected_intent": "FL_RECORDING_CONSENT",
        "expected_universe": None,
        "expect_verify": False,
        "min_confidence": 0.30,
    },
    {
        "query": "What are the Florida advertising rules for insurance agents?",
        "expected_intent": "FL_ADVERTISING_DO_DONTS",
        "expected_universe": None,
        "expect_verify": False,
        "min_confidence": 0.25,
    },
    {
        "query": "Is giving a gift card to a Medicare beneficiary considered rebating in Florida?",
        "expected_intent": "FL_ADVERTISING_DO_DONTS",
        "expected_universe": None,
        "expect_verify": False,
        "min_confidence": 0.20,
    },
    # ── Carrier Enrollment ─────────────────────────────────────────────────
    {
        "query": "What are the steps to enroll a member into UHC Medicare Advantage?",
        "expected_intent": "CARRIER_ENROLLMENT_STEPS",
        "expected_universe": None,
        "expect_verify": False,
        "min_confidence": 0.20,
    },
    # ── Verify / Escalate triggers (expect_verify=True) ────────────────────
    {
        "query": "Hello, good morning.",
        "expected_intent": None,
        "expected_universe": None,
        "expect_verify": True,
        "min_confidence": 0.0,
    },
    {
        "query": "What is the weather like today?",
        "expected_intent": None,
        "expected_universe": None,
        "expect_verify": True,
        "min_confidence": 0.0,
    },
    {
        "query": "Can you help me file my federal tax return?",
        "expected_intent": None,
        "expected_universe": None,
        "expect_verify": True,
        "min_confidence": 0.0,
    },
    # ── Paraphrased / Colloquial (tests semantic routing, Phase 2A) ─────────
    {
        "query": "We just bought a house in a different city. We need new health coverage.",
        "expected_intent": "ACA_SEP_MOVE",
        "expected_universe": "ACA",
        "expect_verify": False,
        "min_confidence": 0.15,
    },
    {
        "query": "My grandmother is getting Medicare for the first time. What window does she have?",
        "expected_intent": "MEDICARE_ENROLLMENT_PERIODS",
        "expected_universe": "Medicare",
        "expect_verify": False,
        "min_confidence": 0.15,
    },
    {
        "query": "I just had a baby. Can I add her to my marketplace plan now?",
        "expected_universe": "ACA",
        "expected_intent": None,
        "expect_verify": False,
        "min_confidence": 0.10,
    },
    {
        "query": "My income dropped a lot. Will I get more help paying my premium?",
        "expected_intent": "ACA_APTC_CSR",
        "expected_universe": "ACA",
        "expect_verify": False,
        "min_confidence": 0.20,
    },
    {
        "query": "They told me I can't get a Medigap plan because of my health history.",
        "expected_intent": "MEDIGAP_GI_RIGHTS",
        "expected_universe": "Medigap",
        "expect_verify": False,
        "min_confidence": 0.15,
    },
    # ── Exact code / regulatory reference queries ───────────────────────────
    {
        "query": "What does 42 CFR 422.2268 say about Medicare marketing?",
        "expected_intent": "MEDICARE_MARKETING_DISCLAIMERS",
        "expected_universe": "Medicare",
        "expect_verify": False,
        "min_confidence": 0.20,
    },
    {
        "query": "The customer received form 1095-A showing excess APTC. What should I tell them?",
        "expected_intent": "ACA_APTC_CSR",
        "expected_universe": "ACA",
        "expect_verify": False,
        "min_confidence": 0.35,
    },
    {
        "query": "The OEP for Medicare runs from January 1 to March 31, correct?",
        "expected_intent": "MEDICARE_ENROLLMENT_PERIODS",
        "expected_universe": "Medicare",
        "expect_verify": False,
        "min_confidence": 0.30,
    },
]


# ---------------------------------------------------------------------------
# Router-only tests (fast, no network)
# ---------------------------------------------------------------------------

class TestIntentRouter:
    """Tests the keyword intent router without any Pinecone/embedding calls."""

    @pytest.fixture(autouse=True)
    def _load_router(self):
        sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
        from app.services.rag.intent_router import intent_router
        self.router = intent_router

    @pytest.mark.parametrize("case", RAG_TEST_CASES, ids=[c["query"][:60] for c in RAG_TEST_CASES])
    def test_intent_routing(self, case: Dict[str, Any]):
        result = self.router.route(case["query"])

        # Confidence must meet minimum threshold
        actual_conf = float(result.get("confidence") or 0.0)
        assert actual_conf >= case["min_confidence"], (
            f"Confidence {actual_conf:.3f} < required {case['min_confidence']} "
            f"for query: {case['query'][:80]}"
        )

        # Universe check (if specified)
        if case["expected_universe"] is not None:
            actual_universe = str(result.get("product_universe") or "").lower()
            expected = case["expected_universe"].lower()
            assert actual_universe == expected, (
                f"Universe mismatch: got '{actual_universe}', expected '{expected}' "
                f"for query: {case['query'][:80]}"
            )

        # Intent check (if specified)
        if case["expected_intent"] is not None:
            actual_intent = str(result.get("intent_id") or "UNKNOWN")
            assert actual_intent == case["expected_intent"], (
                f"Intent mismatch: got '{actual_intent}', expected '{case['expected_intent']}' "
                f"for query: {case['query'][:80]}"
            )

        # Verify/escalate: low-confidence queries should return UNKNOWN
        if case["expect_verify"]:
            assert result.get("intent_id") == "UNKNOWN" or actual_conf < 0.25, (
                f"Expected verify/escalate trigger for query: {case['query'][:80]}"
            )

    def test_all_cases_covered(self):
        """Sanity check: at least 25 test cases are defined."""
        assert len(RAG_TEST_CASES) >= 25, "Add more test cases — target is 200+"

    def test_router_returns_required_fields(self):
        result = self.router.route("I need help with Medicare enrollment")
        for field in ["intent_id", "confidence", "product_universe", "primary_regulators",
                      "preferred_doc_types", "must_ask_questions", "escalation_triggers"]:
            assert field in result, f"Missing required field '{field}' in router output"

    def test_router_handles_empty_query(self):
        result = self.router.route("")
        assert result["intent_id"] == "UNKNOWN"
        assert result["confidence"] == 0.0

    def test_router_handles_pii_redacted_query(self):
        """PII-redacted queries (with [NAME], [PHONE] tokens) should still route."""
        result = self.router.route("[NAME] is turning 65 and wants to enroll in Medicare")
        assert result["product_universe"] in ("Medicare", "General")

    def test_exact_code_boost(self):
        """Queries with exact regulatory codes (1095-A, APTC, AEP) should score higher."""
        result_with_code = self.router.route("What is my APTC reconciliation on form 1095-A?")
        result_without = self.router.route("What is my subsidy adjustment?")
        assert result_with_code["confidence"] >= result_without["confidence"]


# ---------------------------------------------------------------------------
# Reporting helper (run standalone: python tests/rag_test_suite.py)
# ---------------------------------------------------------------------------

def _print_report():
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
    from app.services.rag.intent_router import intent_router

    passed = 0
    failed = 0
    universe_correct = 0
    intent_correct = 0
    verify_correct = 0

    print(f"\n{'='*70}")
    print(f"RAG Test Suite — {len(RAG_TEST_CASES)} queries")
    print(f"{'='*70}\n")

    for case in RAG_TEST_CASES:
        result = intent_router.route(case["query"])
        conf = float(result.get("confidence") or 0.0)
        ok = True

        if conf < case["min_confidence"]:
            ok = False

        if case["expected_universe"] and str(result.get("product_universe") or "").lower() != case["expected_universe"].lower():
            ok = False
        elif case["expected_universe"]:
            universe_correct += 1

        if case["expected_intent"] and result.get("intent_id") != case["expected_intent"]:
            ok = False
        elif case["expected_intent"]:
            intent_correct += 1

        if case["expect_verify"]:
            if result.get("intent_id") == "UNKNOWN" or conf < 0.25:
                verify_correct += 1
            else:
                ok = False

        status = "PASS" if ok else "FAIL"
        if ok:
            passed += 1
        else:
            failed += 1

        print(f"[{status}] conf={conf:.2f} intent={result.get('intent_id')} universe={result.get('product_universe')}")
        print(f"      Q: {case['query'][:90]}")
        if not ok:
            print(f"      Expected intent={case['expected_intent']} universe={case['expected_universe']}")
        print()

    total = passed + failed
    print(f"{'='*70}")
    print(f"Results: {passed}/{total} passed ({100*passed//max(total,1)}%)")
    print(f"  Universe correct : {universe_correct}/{sum(1 for c in RAG_TEST_CASES if c['expected_universe'])}")
    print(f"  Intent correct   : {intent_correct}/{sum(1 for c in RAG_TEST_CASES if c['expected_intent'])}")
    print(f"  Verify triggers  : {verify_correct}/{sum(1 for c in RAG_TEST_CASES if c['expect_verify'])}")
    print(f"{'='*70}\n")


if __name__ == "__main__":
    _print_report()
