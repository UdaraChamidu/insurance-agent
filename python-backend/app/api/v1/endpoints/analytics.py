import logging
from datetime import datetime, timedelta, date
from collections import Counter

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.database import get_db
from app.models import Lead, Appointment, Document, PipelineHistory

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/overview")
async def get_analytics_overview(db: Session = Depends(get_db)):
    """Return CRM overview stats for the analytics dashboard."""

    total_leads = db.query(func.count(Lead.id)).scalar() or 0
    individual_leads = db.query(func.count(Lead.id)).filter(Lead.leadType == "individual").scalar() or 0
    group_leads = db.query(func.count(Lead.id)).filter(Lead.leadType == "group").scalar() or 0

    # Pipeline distribution
    pipeline_rows = (
        db.query(Lead.pipelineStatus, func.count(Lead.id))
        .group_by(Lead.pipelineStatus)
        .all()
    )
    pipeline_distribution = {status: count for status, count in pipeline_rows}

    # Leads created over last 30 days (daily)
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    recent_leads = (
        db.query(Lead)
        .filter(Lead.createdAt >= thirty_days_ago)
        .all()
    )
    leads_by_day = Counter()
    for lead in recent_leads:
        day = lead.createdAt.strftime("%Y-%m-%d") if lead.createdAt else "unknown"
        leads_by_day[day] += 1

    # Appointment stats
    total_appointments = db.query(func.count(Appointment.id)).scalar() or 0
    appointment_statuses = (
        db.query(Appointment.status, func.count(Appointment.id))
        .group_by(Appointment.status)
        .all()
    )
    appointment_distribution = {status: count for status, count in appointment_statuses}

    # Documents count
    total_documents = db.query(func.count(Document.id)).scalar() or 0

    # Conversion metrics
    closed_won = pipeline_distribution.get("closed_won", 0) + pipeline_distribution.get("enrolled", 0)
    closed_lost = pipeline_distribution.get("closed_lost", 0) + pipeline_distribution.get("lost", 0)
    total_closed = closed_won + closed_lost
    win_rate = round((closed_won / total_closed * 100), 1) if total_closed > 0 else 0

    # Upcoming renewals (next 90 days)
    today = date.today()
    ninety_days = today + timedelta(days=90)
    upcoming_renewals = (
        db.query(func.count(Lead.id))
        .filter(
            Lead.leadType == "group",
            Lead.renewalDate.isnot(None),
            Lead.renewalDate >= today,
            Lead.renewalDate <= ninety_days,
        )
        .scalar() or 0
    )

    # Recent pipeline activity (last 20 changes)
    recent_history = (
        db.query(PipelineHistory)
        .order_by(PipelineHistory.changedAt.desc())
        .limit(20)
        .all()
    )
    pipeline_activity = []
    for h in recent_history:
        lead = db.query(Lead).filter(Lead.id == h.leadId).first()
        pipeline_activity.append({
            "id": h.id,
            "leadId": h.leadId,
            "leadName": (lead.companyName or f"{lead.firstName or ''} {lead.lastName or ''}".strip()) if lead else "Unknown",
            "fromStage": h.fromStage,
            "toStage": h.toStage,
            "notes": h.notes,
            "changedAt": h.changedAt.isoformat() if h.changedAt else None,
        })

    # Top states
    state_rows = (
        db.query(Lead.state, func.count(Lead.id))
        .filter(Lead.state.isnot(None), Lead.state != "")
        .group_by(Lead.state)
        .order_by(func.count(Lead.id).desc())
        .limit(10)
        .all()
    )
    top_states = {state: count for state, count in state_rows}

    return {
        "success": True,
        "overview": {
            "totalLeads": total_leads,
            "individualLeads": individual_leads,
            "groupLeads": group_leads,
            "totalAppointments": total_appointments,
            "totalDocuments": total_documents,
            "closedWon": closed_won,
            "closedLost": closed_lost,
            "winRate": win_rate,
            "upcomingRenewals": upcoming_renewals,
        },
        "pipelineDistribution": pipeline_distribution,
        "appointmentDistribution": appointment_distribution,
        "leadsByDay": dict(sorted(leads_by_day.items())),
        "topStates": top_states,
        "recentActivity": pipeline_activity,
    }
