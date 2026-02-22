from __future__ import annotations

import os
import threading
import inspect
from datetime import datetime, timezone
from typing import Any, Dict, Optional


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _safe_int(value: Any, default: int = 0) -> int:
    try:
        if value is None:
            return default
        return int(value)
    except (TypeError, ValueError):
        return default


def _safe_float(value: Any, default: Optional[float] = None) -> Optional[float]:
    try:
        if value is None:
            return default
        parsed = float(value)
        return parsed
    except (TypeError, ValueError):
        return default


def _positive_int_env(name: str) -> Optional[int]:
    raw = os.getenv(name, "").strip()
    if not raw:
        return None
    parsed = _safe_int(raw, 0)
    return parsed if parsed > 0 else None


def _positive_float_env(name: str) -> Optional[float]:
    raw = os.getenv(name, "").strip()
    if not raw:
        return None
    parsed = _safe_float(raw, None)
    if parsed is None or parsed <= 0:
        return None
    return parsed


def _new_counter() -> Dict[str, Any]:
    return {
        "requests": 0,
        "errors": 0,
        "promptTokens": 0,
        "completionTokens": 0,
        "totalTokens": 0,
        "estimatedTokens": 0,
        "effectiveTokens": 0,
        "tokenSource": "none",
        "lastRequestAt": None,
        "lastErrorAt": None,
        "lastErrorMessage": "",
    }


class GeminiUsageTracker:
    """
    Tracks observed Gemini token usage from responses handled by this backend process.
    This is process-local telemetry, not a global Google billing/quota feed.
    """

    def __init__(self):
        self._lock = threading.Lock()
        self.started_at = _now_utc()
        self.today_utc_date = self.started_at.date().isoformat()
        self.since_start = _new_counter()
        self.today = _new_counter()
        self.operations: Dict[str, Dict[str, Any]] = {}

    def _rollover_day_if_needed(self):
        current_day = _now_utc().date().isoformat()
        if current_day != self.today_utc_date:
            self.today_utc_date = current_day
            self.today = _new_counter()
            for op_stats in self.operations.values():
                op_stats["today"] = _new_counter()

    def _extract_usage_block(self, payload: Any) -> Any:
        if payload is None:
            return None
        if isinstance(payload, dict):
            if payload.get("usage_metadata") is not None:
                return payload.get("usage_metadata")
            if payload.get("usageMetadata") is not None:
                return payload.get("usageMetadata")
            return None

        usage = getattr(payload, "usage_metadata", None)
        if usage is not None:
            return usage
        usage = getattr(payload, "usageMetadata", None)
        if usage is not None:
            return usage
        return None

    def _to_mapping(self, payload: Any) -> Dict[str, Any]:
        if isinstance(payload, dict):
            return payload
        if payload is None:
            return {}
        if hasattr(payload, "model_dump"):
            try:
                model_dump = getattr(payload, "model_dump")
                if callable(model_dump) and not inspect.iscoroutinefunction(model_dump):
                    dumped = model_dump()
                    if isinstance(dumped, dict):
                        return dumped
            except Exception:
                pass
        if hasattr(payload, "to_dict"):
            try:
                to_dict = getattr(payload, "to_dict")
                if callable(to_dict) and not inspect.iscoroutinefunction(to_dict):
                    dumped = to_dict()
                    if isinstance(dumped, dict):
                        return dumped
            except Exception:
                pass

        data: Dict[str, Any] = {}
        for key in (
            "prompt_token_count",
            "promptTokenCount",
            "input_token_count",
            "inputTokenCount",
            "candidates_token_count",
            "candidatesTokenCount",
            "output_token_count",
            "outputTokenCount",
            "total_token_count",
            "totalTokenCount",
        ):
            if hasattr(payload, key):
                data[key] = getattr(payload, key)
        return data

    def _extract_token_counts(self, payload: Any) -> Dict[str, int]:
        usage_block = self._extract_usage_block(payload)
        usage_map = self._to_mapping(usage_block)

        prompt_tokens = (
            _safe_int(usage_map.get("prompt_token_count"), 0)
            or _safe_int(usage_map.get("promptTokenCount"), 0)
            or _safe_int(usage_map.get("input_token_count"), 0)
            or _safe_int(usage_map.get("inputTokenCount"), 0)
        )
        completion_tokens = (
            _safe_int(usage_map.get("candidates_token_count"), 0)
            or _safe_int(usage_map.get("candidatesTokenCount"), 0)
            or _safe_int(usage_map.get("output_token_count"), 0)
            or _safe_int(usage_map.get("outputTokenCount"), 0)
        )
        total_tokens = (
            _safe_int(usage_map.get("total_token_count"), 0)
            or _safe_int(usage_map.get("totalTokenCount"), 0)
        )
        if total_tokens <= 0 and (prompt_tokens > 0 or completion_tokens > 0):
            total_tokens = prompt_tokens + completion_tokens

        return {
            "promptTokens": max(0, prompt_tokens),
            "completionTokens": max(0, completion_tokens),
            "totalTokens": max(0, total_tokens),
        }

    def _estimate_tokens(self, text: Optional[str] = None, explicit: Optional[int] = None) -> int:
        if explicit is not None:
            return max(0, _safe_int(explicit, 0))
        if not text:
            return 0
        # Simple heuristic: ~4 chars per token for English text.
        return max(1, int(len(text) / 4))

    def _operation_bucket(self, operation: str) -> Dict[str, Any]:
        if operation not in self.operations:
            self.operations[operation] = {
                "sinceStart": _new_counter(),
                "today": _new_counter(),
            }
        return self.operations[operation]

    def _add_counts(self, bucket: Dict[str, Any], counts: Dict[str, int], estimated_tokens: int):
        bucket["requests"] += 1
        bucket["promptTokens"] += max(0, counts.get("promptTokens", 0))
        bucket["completionTokens"] += max(0, counts.get("completionTokens", 0))
        bucket["totalTokens"] += max(0, counts.get("totalTokens", 0))
        bucket["estimatedTokens"] += max(0, estimated_tokens)
        if bucket["totalTokens"] > 0:
            bucket["effectiveTokens"] = bucket["totalTokens"]
            bucket["tokenSource"] = "api_reported"
        elif bucket["estimatedTokens"] > 0:
            bucket["effectiveTokens"] = bucket["estimatedTokens"]
            bucket["tokenSource"] = "estimated"
        else:
            bucket["effectiveTokens"] = 0
            bucket["tokenSource"] = "none"
        bucket["lastRequestAt"] = _now_utc().isoformat()

    def record_response(
        self,
        operation: str,
        response_payload: Any = None,
        request_text: Optional[str] = None,
        estimated_input_tokens: Optional[int] = None,
    ):
        with self._lock:
            self._rollover_day_if_needed()
            counts = self._extract_token_counts(response_payload)
            estimated = 0
            if counts.get("totalTokens", 0) <= 0:
                estimated = self._estimate_tokens(request_text, estimated_input_tokens)

            self._add_counts(self.since_start, counts, estimated)
            self._add_counts(self.today, counts, estimated)

            op_bucket = self._operation_bucket(operation)
            self._add_counts(op_bucket["sinceStart"], counts, estimated)
            self._add_counts(op_bucket["today"], counts, estimated)

    def record_error(self, operation: str, error: Any):
        message = str(error)[:500]
        with self._lock:
            self._rollover_day_if_needed()
            now_iso = _now_utc().isoformat()

            for bucket in (self.since_start, self.today):
                bucket["errors"] += 1
                bucket["lastErrorAt"] = now_iso
                bucket["lastErrorMessage"] = message

            op_bucket = self._operation_bucket(operation)
            for bucket in (op_bucket["sinceStart"], op_bucket["today"]):
                bucket["errors"] += 1
                bucket["lastErrorAt"] = now_iso
                bucket["lastErrorMessage"] = message

    def _copy_counter(self, counter: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "requests": int(counter.get("requests", 0)),
            "errors": int(counter.get("errors", 0)),
            "promptTokens": int(counter.get("promptTokens", 0)),
            "completionTokens": int(counter.get("completionTokens", 0)),
            "totalTokens": int(counter.get("totalTokens", 0)),
            "estimatedTokens": int(counter.get("estimatedTokens", 0)),
            "effectiveTokens": int(counter.get("effectiveTokens", 0)),
            "tokenSource": str(counter.get("tokenSource") or "none"),
            "lastRequestAt": counter.get("lastRequestAt"),
            "lastErrorAt": counter.get("lastErrorAt"),
            "lastErrorMessage": counter.get("lastErrorMessage") or "",
        }

    def _build_limits(self) -> Dict[str, Any]:
        return {
            "softTotalTokenLimit": _positive_int_env("GEMINI_SOFT_TOTAL_TOKEN_LIMIT"),
            "softDailyTokenLimit": _positive_int_env("GEMINI_SOFT_DAILY_TOKEN_LIMIT"),
            "softBudgetUsd": _positive_float_env("GEMINI_SOFT_BUDGET_USD"),
            "estimatedUsdPer1MTokens": _positive_float_env("GEMINI_ESTIMATED_USD_PER_1M_TOKENS"),
        }

    def _with_utilization(self, snapshot: Dict[str, Any], limits: Dict[str, Any]) -> Dict[str, Any]:
        utilization: Dict[str, Any] = {}

        total_tokens = snapshot["sinceStart"]["effectiveTokens"]
        daily_tokens = snapshot["today"]["effectiveTokens"]

        soft_total = limits.get("softTotalTokenLimit")
        if soft_total:
            utilization["softTotalTokenLimitPct"] = round((total_tokens / soft_total) * 100, 2)

        soft_daily = limits.get("softDailyTokenLimit")
        if soft_daily:
            utilization["softDailyTokenLimitPct"] = round((daily_tokens / soft_daily) * 100, 2)

        usd_per_1m = limits.get("estimatedUsdPer1MTokens")
        estimated_cost = None
        if usd_per_1m:
            estimated_cost = round((total_tokens / 1_000_000.0) * usd_per_1m, 4)
            utilization["estimatedCostUsd"] = estimated_cost

        soft_budget = limits.get("softBudgetUsd")
        if soft_budget and estimated_cost is not None:
            utilization["softBudgetPct"] = round((estimated_cost / soft_budget) * 100, 2)

        snapshot["utilization"] = utilization
        return snapshot

    def get_snapshot(self) -> Dict[str, Any]:
        with self._lock:
            self._rollover_day_if_needed()

            operations_snapshot: Dict[str, Any] = {}
            for op_name, op_stats in self.operations.items():
                operations_snapshot[op_name] = {
                    "sinceStart": self._copy_counter(op_stats.get("sinceStart", {})),
                    "today": self._copy_counter(op_stats.get("today", {})),
                }

            snapshot = {
                "trackingMode": "process_observed",
                "startedAt": self.started_at.isoformat(),
                "todayUtcDate": self.today_utc_date,
                "sinceStart": self._copy_counter(self.since_start),
                "today": self._copy_counter(self.today),
                "operations": operations_snapshot,
                "limitations": (
                    "Gemini API key mode does not expose a reliable global billing/quota endpoint. "
                    "These are observed values from this backend process only."
                ),
            }

            limits = self._build_limits()
            snapshot["limits"] = limits
            return self._with_utilization(snapshot, limits)


gemini_usage_tracker = GeminiUsageTracker()
