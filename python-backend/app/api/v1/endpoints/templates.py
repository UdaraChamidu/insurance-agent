import re
import logging
from typing import Any, Dict, List, Optional
from datetime import datetime

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import MessageTemplate, Lead
from app.services.communication_service import communication_service

logger = logging.getLogger(__name__)

router = APIRouter()


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class TemplateCreate(BaseModel):
    name: str
    type: str  # "email" or "sms"
    subject: Optional[str] = None
    body: str
    variables: Optional[List[str]] = None
    triggerStage: Optional[str] = None
    isActive: bool = True


class TemplateUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    subject: Optional[str] = None
    body: Optional[str] = None
    variables: Optional[List[str]] = None
    triggerStage: Optional[str] = None
    isActive: Optional[bool] = None


class TemplateSendRequest(BaseModel):
    leadId: str
    templateId: str
    extraVariables: Optional[Dict[str, str]] = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_VARIABLE_RE = re.compile(r"\{\{(\w+)\}\}")


def _render_template(template_str: str, variables: Dict[str, str]) -> str:
    """Replace {{variable_name}} placeholders with actual values."""
    def _replacer(match):
        key = match.group(1)
        return variables.get(key, match.group(0))
    return _VARIABLE_RE.sub(_replacer, template_str)


def _build_variables_from_lead(lead: Lead) -> Dict[str, str]:
    """Extract common template variables from a Lead record."""
    return {
        "company_name": lead.companyName or "",
        "contact_name": lead.contactPerson or f"{lead.firstName or ''} {lead.lastName or ''}".strip(),
        "first_name": lead.firstName or "",
        "last_name": lead.lastName or "",
        "email": lead.email or "",
        "phone": lead.phone or "",
        "state": lead.state or "",
        "num_employees": str(lead.numEmployees or ""),
        "num_eligible": str(lead.numEligible or ""),
        "industry": lead.industry or "",
        "renewal_date": str(lead.renewalDate) if lead.renewalDate else "",
        "current_carrier": lead.currentCarrier or "",
        "current_plan": lead.currentPlan or "",
        "contribution_strategy": lead.contributionStrategy or "",
        "pipeline_status": lead.pipelineStatus or "",
        "schedule_link": "/schedule",
        "census_link": "/employer-census",
        "contact_link": "/contact",
    }


def _serialize(t: MessageTemplate) -> dict:
    return {
        "id": t.id,
        "name": t.name,
        "type": t.type,
        "subject": t.subject,
        "body": t.body,
        "variables": t.variables,
        "triggerStage": t.triggerStage,
        "isActive": t.isActive,
        "createdAt": t.createdAt.isoformat() if t.createdAt else None,
        "updatedAt": t.updatedAt.isoformat() if t.updatedAt else None,
    }


# ---------------------------------------------------------------------------
# CRUD endpoints
# ---------------------------------------------------------------------------

@router.get("/")
async def list_templates(db: Session = Depends(get_db)):
    """Return all message templates."""
    templates = db.query(MessageTemplate).order_by(MessageTemplate.createdAt).all()
    return {"success": True, "templates": [_serialize(t) for t in templates]}


@router.get("/{template_id}")
async def get_template(template_id: str, db: Session = Depends(get_db)):
    t = db.query(MessageTemplate).filter(MessageTemplate.id == template_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Template not found")
    return {"success": True, "template": _serialize(t)}


@router.post("/")
async def create_template(data: TemplateCreate, db: Session = Depends(get_db)):
    if data.type not in ("email", "sms"):
        raise HTTPException(status_code=400, detail="type must be 'email' or 'sms'")

    existing = db.query(MessageTemplate).filter(MessageTemplate.name == data.name).first()
    if existing:
        raise HTTPException(status_code=409, detail="Template with this name already exists")

    template = MessageTemplate(
        name=data.name,
        type=data.type,
        subject=data.subject,
        body=data.body,
        variables=data.variables,
        triggerStage=data.triggerStage,
        isActive=data.isActive,
    )
    db.add(template)
    db.commit()
    db.refresh(template)
    return {"success": True, "template": _serialize(template)}


@router.put("/{template_id}")
async def update_template(template_id: str, data: TemplateUpdate, db: Session = Depends(get_db)):
    t = db.query(MessageTemplate).filter(MessageTemplate.id == template_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Template not found")

    if data.type is not None and data.type not in ("email", "sms"):
        raise HTTPException(status_code=400, detail="type must be 'email' or 'sms'")

    for field in ("name", "type", "subject", "body", "variables", "triggerStage", "isActive"):
        value = getattr(data, field, None)
        if value is not None:
            setattr(t, field, value)

    t.updatedAt = datetime.utcnow()
    db.commit()
    db.refresh(t)
    return {"success": True, "template": _serialize(t)}


@router.delete("/{template_id}")
async def delete_template(template_id: str, db: Session = Depends(get_db)):
    t = db.query(MessageTemplate).filter(MessageTemplate.id == template_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Template not found")
    db.delete(t)
    db.commit()
    return {"success": True, "deleted": template_id}


# ---------------------------------------------------------------------------
# Send a rendered template to a lead
# ---------------------------------------------------------------------------

@router.post("/send")
async def send_template(data: TemplateSendRequest, db: Session = Depends(get_db)):
    """Render a template with lead data and send via email/SMS."""
    template = db.query(MessageTemplate).filter(MessageTemplate.id == data.templateId).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    lead = db.query(Lead).filter(Lead.id == data.leadId).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    variables = _build_variables_from_lead(lead)
    if data.extraVariables:
        variables.update(data.extraVariables)

    rendered_body = _render_template(template.body, variables)
    rendered_subject = _render_template(template.subject or "", variables) if template.subject else ""

    results = {"email": False, "sms": False}

    if template.type == "email" and lead.email:
        try:
            communication_service.email_service.send_email(
                lead.email, rendered_subject, rendered_body
            )
            results["email"] = True
            logger.info(f"Template '{template.name}' email sent to {lead.email}")
        except Exception as exc:
            logger.error(f"Failed to send template email: {exc}")

    if template.type == "sms" and lead.phone:
        try:
            communication_service.twilio_service.send_sms(lead.phone, rendered_body)
            results["sms"] = True
            logger.info(f"Template '{template.name}' SMS sent to {lead.phone}")
        except Exception as exc:
            logger.error(f"Failed to send template SMS: {exc}")

    return {
        "success": True,
        "templateName": template.name,
        "renderedSubject": rendered_subject,
        "renderedBody": rendered_body,
        "results": results,
    }


# ---------------------------------------------------------------------------
# Seed default templates
# ---------------------------------------------------------------------------

DEFAULT_TEMPLATES = [
    {
        "name": "First Outreach",
        "type": "email",
        "subject": "Affordable Group Health Insurance Options for {{company_name}}",
        "body": (
            "Hi {{contact_name}},\n\n"
            "My name is Abdelrahman with Elite Deal Broker. I specialize in helping businesses like "
            "{{company_name}} find the best group health insurance plans through Warner Pacific.\n\n"
            "I'd love to schedule a quick 15-minute discovery call to learn about your team's needs and "
            "show you how we can save you time and money on your group benefits.\n\n"
            "You can book a call at your convenience here: {{schedule_link}}\n\n"
            "Looking forward to connecting!\n\n"
            "Best regards,\n"
            "Abdelrahman\nElite Deal Broker"
        ),
        "variables": ["company_name", "contact_name", "schedule_link"],
        "triggerStage": "new_lead",
    },
    {
        "name": "Missed Call Follow-Up",
        "type": "email",
        "subject": "Sorry I Missed You, {{contact_name}}!",
        "body": (
            "Hi {{contact_name}},\n\n"
            "I tried reaching you earlier but wasn't able to connect. I'd love to chat about group health "
            "insurance options for {{company_name}}.\n\n"
            "If you'd like to reschedule, you can pick a time that works for you here: {{schedule_link}}\n\n"
            "Feel free to reply to this email or call me back at your convenience.\n\n"
            "Best,\n"
            "Abdelrahman\nElite Deal Broker"
        ),
        "variables": ["company_name", "contact_name", "schedule_link"],
        "triggerStage": None,
    },
    {
        "name": "Booking Confirmation",
        "type": "email",
        "subject": "Your Discovery Call is Confirmed - {{company_name}}",
        "body": (
            "Hi {{contact_name}},\n\n"
            "Great news! Your discovery call has been confirmed.\n\n"
            "To make the most of our time, please have the following ready:\n"
            "- Approximate number of employees: {{num_employees}}\n"
            "- Current insurance carrier (if any): {{current_carrier}}\n"
            "- Your renewal date (if known): {{renewal_date}}\n\n"
            "If you need to reschedule or cancel, you can manage your appointment from the confirmation email.\n\n"
            "Looking forward to speaking with you!\n\n"
            "Best,\n"
            "Abdelrahman\nElite Deal Broker"
        ),
        "variables": ["company_name", "contact_name", "num_employees", "current_carrier", "renewal_date"],
        "triggerStage": "discovery_scheduled",
    },
    {
        "name": "Census Request",
        "type": "email",
        "subject": "Employee Census Needed - {{company_name}} Group Quote",
        "body": (
            "Hi {{contact_name}},\n\n"
            "Thank you for your time on our discovery call! To move forward with getting quotes for "
            "{{company_name}}, I'll need an employee census.\n\n"
            "Please use our secure census upload page to submit your data:\n"
            "{{census_link}}\n\n"
            "The census should include for each employee:\n"
            "- Full name\n"
            "- Date of birth\n"
            "- Gender\n"
            "- Zip code\n"
            "- Dependents (spouse/children with DOBs)\n"
            "- Tobacco use (yes/no)\n"
            "- Coverage election (enroll/waive)\n\n"
            "A downloadable CSV template is available on the upload page.\n\n"
            "Please submit by the end of this week so we can get quotes back quickly.\n\n"
            "Best,\n"
            "Abdelrahman\nElite Deal Broker"
        ),
        "variables": ["company_name", "contact_name", "census_link"],
        "triggerStage": "census_requested",
    },
    {
        "name": "Follow-Up After Quote",
        "type": "email",
        "subject": "Your Group Health Insurance Options - {{company_name}}",
        "body": (
            "Hi {{contact_name}},\n\n"
            "I've received the quotes back from Warner Pacific for {{company_name}}. "
            "I've put together a summary of the best options for your team.\n\n"
            "I'd like to schedule a brief meeting to walk through the plans, answer any questions, "
            "and help you make the best decision for your employees.\n\n"
            "You can book a time here: {{schedule_link}}\n\n"
            "If you have any immediate questions, don't hesitate to reach out.\n\n"
            "Best,\n"
            "Abdelrahman\nElite Deal Broker"
        ),
        "variables": ["company_name", "contact_name", "schedule_link"],
        "triggerStage": "quotes_received",
    },
    {
        "name": "Renewal Review Outreach",
        "type": "email",
        "subject": "Upcoming Renewal Review - {{company_name}}",
        "body": (
            "Hi {{contact_name}},\n\n"
            "I hope this message finds you well! I wanted to reach out because your group health insurance "
            "renewal date for {{company_name}} is approaching ({{renewal_date}}).\n\n"
            "This is a great time to review your current plan and explore whether there are better or more "
            "cost-effective options available through Warner Pacific.\n\n"
            "I'd love to set up a quick call to review your renewal options. Book a time here: "
            "{{schedule_link}}\n\n"
            "Looking forward to helping you and your team!\n\n"
            "Best,\n"
            "Abdelrahman\nElite Deal Broker"
        ),
        "variables": ["company_name", "contact_name", "renewal_date", "schedule_link"],
        "triggerStage": "renewal_followup",
    },
]


@router.post("/seed")
async def seed_default_templates(db: Session = Depends(get_db)):
    """Create the 6 default workflow templates (skips if they already exist)."""
    created = []
    skipped = []

    for tpl in DEFAULT_TEMPLATES:
        existing = db.query(MessageTemplate).filter(MessageTemplate.name == tpl["name"]).first()
        if existing:
            skipped.append(tpl["name"])
            continue

        template = MessageTemplate(
            name=tpl["name"],
            type=tpl["type"],
            subject=tpl.get("subject"),
            body=tpl["body"],
            variables=tpl.get("variables"),
            triggerStage=tpl.get("triggerStage"),
            isActive=True,
        )
        db.add(template)
        created.append(tpl["name"])

    db.commit()
    return {"success": True, "created": created, "skipped": skipped}
