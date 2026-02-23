import os
import re
from typing import Any, Dict, List, Optional

import google.generativeai as genai
from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.core.config import settings
from app.services.llm.usage_tracker import gemini_usage_tracker

router = APIRouter()

if settings.GEMINI_API_KEY:
    genai.configure(api_key=settings.GEMINI_API_KEY)

QA_QUICK_REPLIES = [
    "What services do you offer?",
    "How do I book a consultation?",
    "How does the meeting work?",
]

CHAT_QUICK_REPLIES = [
    "Tell me what this platform does",
    "Can you guide me to book quickly?",
    "What should I prepare before a call?",
]


class PublicChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=800)
    sessionId: Optional[str] = Field(default=None, max_length=120)
    mode: Optional[str] = Field(default="qa", max_length=20)
    history: List[Dict[str, str]] = Field(default_factory=list)


class PublicChatResponse(BaseModel):
    answer: str
    mode: str
    quickReplies: List[str] = Field(default_factory=list)
    cta: Optional[Dict[str, str]] = None


FAQ_ENTRIES: List[Dict[str, Any]] = [
    {
        "id": "services",
        "keywords": [
            "service",
            "offer",
            "help",
            "what do you do",
            "insurance type",
            "coverage",
        ],
        "answer": (
            "We help with individual and family health insurance, Medicare guidance, "
            "small business coverage, and life or supplemental insurance consultations. "
            "Our team focuses on clear, compliance-first guidance."
        ),
        "quickReplies": [
            "How do I book a consultation?",
            "Is there any obligation to buy?",
            "What happens in the meeting?",
        ],
    },
    {
        "id": "booking",
        "keywords": [
            "book",
            "schedule",
            "appointment",
            "consultation",
            "meeting link",
        ],
        "answer": (
            "You can click 'Schedule Consultation' on the home page, complete the intake form, "
            "pick a date and time, and receive a meeting link. You can also cancel or reschedule "
            "using your appointment management link."
        ),
        "quickReplies": [
            "What information is required in intake?",
            "How long is a consultation?",
            "Can I reschedule later?",
        ],
    },
    {
        "id": "meeting_flow",
        "keywords": [
            "meeting",
            "call",
            "video",
            "how it works",
            "consultation process",
            "during consultation",
        ],
        "answer": (
            "During the consultation, you meet an agent in a secure video session. "
            "The platform supports real-time note-taking and AI assistance for the admin side, "
            "so your questions can be addressed quickly and clearly."
        ),
        "quickReplies": [
            "Is my data saved securely?",
            "Do you provide plan recommendations?",
            "How quickly can I get started?",
        ],
    },
    {
        "id": "pricing",
        "keywords": [
            "cost",
            "price",
            "fee",
            "charge",
            "free",
            "payment",
        ],
        "answer": (
            "Initial consultations are generally positioned as no-obligation. "
            "Specific plan costs, premiums, and eligibility depend on your profile "
            "and should be reviewed in a live consultation with an agent."
        ),
        "quickReplies": [
            "Can I book a consultation now?",
            "What documents should I prepare?",
            "How does eligibility work?",
        ],
    },
    {
        "id": "docs_needed",
        "keywords": [
            "document",
            "docs",
            "prepare",
            "what should i bring",
            "required information",
        ],
        "answer": (
            "Typical preparation includes basic contact details, coverage goals, and any existing plan information. "
            "For product-specific discussions, the agent may request additional details during intake or the meeting."
        ),
        "quickReplies": [
            "How do I start intake?",
            "What services do you offer?",
            "How does follow-up work?",
        ],
    },
    {
        "id": "privacy",
        "keywords": [
            "privacy",
            "secure",
            "security",
            "data",
            "safe",
            "recording",
            "transcription",
        ],
        "answer": (
            "The platform is built with structured data handling for lead and meeting workflows. "
            "Admin-side tools can store meeting artifacts for operational follow-up. "
            "If you need policy-level privacy details, request them during your consultation."
        ),
        "quickReplies": [
            "How do I book a consultation?",
            "What happens in the meeting?",
            "Can I reschedule if needed?",
        ],
    },
]


def _normalize_text(value: str) -> str:
    return re.sub(r"\s+", " ", (value or "").strip().lower())


def _find_faq_match(message: str) -> Optional[Dict[str, Any]]:
    normalized = _normalize_text(message)
    if not normalized:
        return None

    best_entry: Optional[Dict[str, Any]] = None
    best_score = 0
    for entry in FAQ_ENTRIES:
        score = 0
        for keyword in entry["keywords"]:
            key = _normalize_text(keyword)
            if not key:
                continue
            if key in normalized:
                # Multi-word matches are weighted a bit higher.
                score += 2 if " " in key else 1
        if score > best_score:
            best_score = score
            best_entry = entry

    # Require at least one reliable signal to prevent random matches.
    if best_score <= 0:
        return None
    return best_entry


def _build_cta() -> Dict[str, str]:
    return {
        "label": "Book Consultation",
        "path": "/intake",
    }


def _trim_history(history: List[Dict[str, str]], limit: int = 6) -> List[Dict[str, str]]:
    safe: List[Dict[str, str]] = []
    for item in history[-limit:]:
        role = str(item.get("role", "")).strip().lower()
        if role not in {"user", "assistant"}:
            continue
        content = str(item.get("content", "")).strip()
        if not content:
            continue
        safe.append({"role": role, "content": content[:500]})
    return safe


async def _generate_ai_answer(message: str, history: List[Dict[str, str]], mode: str) -> str:
    if not settings.GEMINI_API_KEY:
        if mode == "chat":
            return (
                "I can help with general platform guidance and booking steps. "
                "If you want personalized eligibility or pricing advice, please book a consultation with an agent."
            )
        return (
            "I can help with platform questions about services, booking, and meeting flow. "
            "For personal eligibility or plan pricing, please book a consultation with an agent."
        )

    model_name = os.getenv("MEETING_AI_MODEL", "gemini-2.5-flash")
    model = genai.GenerativeModel(model_name)

    platform_context = (
        "Platform context:\n"
        "- This is an insurance consultation platform called Elite Deal Broker.\n"
        "- Public users can complete intake, schedule appointments, and join meetings.\n"
        "- Services include health insurance, Medicare guidance, small business coverage, and life/supplemental insurance.\n"
        "- Consultations are no-obligation in positioning, but exact costs and eligibility require agent review.\n"
        "- Do not provide legal, medical, or tax advice.\n"
        "- If the question is highly personal (eligibility, pricing, claims), advise booking a consultation.\n"
        "- Keep responses concise, clear, and business-safe.\n"
    )

    history_block = "\n".join(
        f"{item['role'].capitalize()}: {item['content']}" for item in history
    )
    if not history_block:
        history_block = "No prior chat history."

    style_instruction = (
        "Mode: Q&A\n"
        "- Give a direct answer first.\n"
        "- Keep it short (max 4 sentences).\n"
        "- If useful, include one practical next step.\n"
    )
    if mode == "chat":
        style_instruction = (
            "Mode: Conversation\n"
            "- Respond in a friendly conversational tone.\n"
            "- Keep it concise (max 5 sentences).\n"
            "- If the user seems uncertain, suggest a simple next step.\n"
        )

    prompt = (
        f"{platform_context}\n"
        f"{style_instruction}\n"
        f"Chat history:\n{history_block}\n\n"
        f"User message: {message}\n\n"
        "Respond in plain text only."
    )

    response = await model.generate_content_async(prompt)
    gemini_usage_tracker.record_response(
        operation="public_chat",
        response_payload=response,
        request_text=prompt,
    )

    answer = (response.text or "").strip()
    if not answer:
        return (
            "I can help with platform services and booking. "
            "For detailed personal guidance, please book a consultation."
        )
    return answer


@router.post("/chat", response_model=PublicChatResponse)
async def public_chat(request: PublicChatRequest):
    message = request.message.strip()
    mode = (request.mode or "qa").strip().lower()
    if mode not in {"qa", "chat"}:
        mode = "qa"

    if not message:
        return PublicChatResponse(
            answer="Please type your question.",
            mode="validation",
            quickReplies=QA_QUICK_REPLIES if mode == "qa" else [],
            cta=_build_cta() if mode == "qa" else None,
        )

    faq_match = _find_faq_match(message) if mode == "qa" else None
    if faq_match and mode == "qa":
        return PublicChatResponse(
            answer=faq_match["answer"],
            mode="faq",
            quickReplies=faq_match.get("quickReplies") or QA_QUICK_REPLIES,
            cta=_build_cta(),
        )

    safe_history = _trim_history(request.history)
    try:
        ai_answer = await _generate_ai_answer(message, safe_history, mode=mode)
        return PublicChatResponse(
            answer=ai_answer,
            mode="ai_chat" if mode == "chat" else "ai",
            quickReplies=[] if mode == "chat" else QA_QUICK_REPLIES,
            cta=None if mode == "chat" else _build_cta(),
        )
    except Exception as error:
        gemini_usage_tracker.record_error("public_chat", error)
        return PublicChatResponse(
            answer=(
                "I can help with platform services, booking flow, and meeting steps. "
                "Please try rephrasing, or book a consultation for detailed guidance."
            ),
            mode="fallback",
            quickReplies=[] if mode == "chat" else QA_QUICK_REPLIES,
            cta=None if mode == "chat" else _build_cta(),
        )
