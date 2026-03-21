"""
Compliance & documentation admin endpoint.

Aggregates compliance data from sessions, pipeline history, and action items
into a single view for the admin compliance dashboard.
"""

from datetime import datetime
from typing import Any, Dict, List

from fastapi import APIRouter, Depends
from sqlalchemy import desc
from sqlalchemy.orm import Session as DBSession

from app.core.database import get_sql_db
from app.models import Lead, PipelineHistory, Session, Transcript

router = APIRouter()


@router.get("/overview", response_model=Dict[str, Any])
async def compliance_overview(db: DBSession = Depends(get_sql_db)):
    """
    Return aggregated compliance data:
    - Sessions with compliance flags, action items, call summaries
    - Pipeline history (full audit trail)
    - Leads with pending action items
    """
    # Sessions that have compliance-relevant data
    sessions = (
        db.query(Session)
        .filter(
            (Session.complianceFlags.isnot(None))
            | (Session.actionItems.isnot(None))
            | (Session.callSummary.isnot(None))
        )
        .order_by(desc(Session.updatedAt))
        .limit(100)
        .all()
    )

    records = []
    for s in sessions:
        lead = db.query(Lead).filter(Lead.id == s.leadId).first()
        lead_name = ""
        if lead:
            if lead.leadType == "group":
                lead_name = lead.companyName or lead.contactPerson or ""
            else:
                lead_name = f"{lead.firstName or ''} {lead.lastName or ''}".strip()

        flags = s.complianceFlags if isinstance(s.complianceFlags, dict) else {}
        action_items = s.actionItems if isinstance(s.actionItems, list) else []

        records.append({
            "sessionId": s.id,
            "leadId": s.leadId,
            "leadName": lead_name,
            "leadType": lead.leadType if lead else "unknown",
            "pipelineStatus": lead.pipelineStatus if lead else None,
            "status": s.status,
            "disposition": s.disposition,
            "callSummary": s.callSummary,
            "complianceFlags": flags,
            "actionItems": action_items,
            "hasWarnings": bool(
                flags.get("forbiddenTopics")
                or not flags.get("disclaimerRead", True)
            ),
            "recordingLink": s.recordingLink,
            "transcriptLink": s.transcriptLink,
            "startTime": s.startTime.isoformat() if s.startTime else None,
            "endTime": s.endTime.isoformat() if s.endTime else None,
            "createdAt": s.createdAt.isoformat() if s.createdAt else None,
            "updatedAt": s.updatedAt.isoformat() if s.updatedAt else None,
        })

    # Recent pipeline changes (audit trail)
    history = (
        db.query(PipelineHistory)
        .order_by(desc(PipelineHistory.changedAt))
        .limit(50)
        .all()
    )

    audit_trail = []
    for h in history:
        lead = db.query(Lead).filter(Lead.id == h.leadId).first()
        lead_name = ""
        if lead:
            if lead.leadType == "group":
                lead_name = lead.companyName or lead.contactPerson or ""
            else:
                lead_name = f"{lead.firstName or ''} {lead.lastName or ''}".strip()

        audit_trail.append({
            "id": h.id,
            "leadId": h.leadId,
            "leadName": lead_name,
            "fromStage": h.fromStage,
            "toStage": h.toStage,
            "notes": h.notes,
            "changedAt": h.changedAt.isoformat() if h.changedAt else None,
        })

    # Summary stats
    total_sessions = db.query(Session).count()
    sessions_with_flags = (
        db.query(Session).filter(Session.complianceFlags.isnot(None)).count()
    )
    sessions_with_warnings = 0
    for r in records:
        if r["hasWarnings"]:
            sessions_with_warnings += 1

    pending_actions = 0
    for r in records:
        for item in r.get("actionItems", []):
            if isinstance(item, dict) and not item.get("completed"):
                pending_actions += 1
            elif isinstance(item, str):
                pending_actions += 1

    return {
        "stats": {
            "totalSessions": total_sessions,
            "sessionsWithFlags": sessions_with_flags,
            "sessionsWithWarnings": sessions_with_warnings,
            "pendingActionItems": pending_actions,
        },
        "records": records,
        "auditTrail": audit_trail,
    }
