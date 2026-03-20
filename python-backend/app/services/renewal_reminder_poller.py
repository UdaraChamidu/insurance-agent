import asyncio
import logging
from datetime import datetime, date, timedelta, timezone

from app.core.database import SessionLocal
from app.models import Lead, MessageTemplate
from app.services.communication_service import communication_service

logger = logging.getLogger(__name__)


class RenewalReminderPoller:
    """
    Checks group leads with upcoming renewal dates and sends the
    "Renewal Review Outreach" template 30 and 60 days before renewal.
    Marks the lead pipeline to renewal_followup when the first reminder is sent.
    """

    def __init__(self):
        self.is_running = False
        self._task = None
        self.poll_interval_seconds = 3600  # check every hour

    async def start(self):
        if self.is_running:
            return
        self.is_running = True
        logger.info("Starting Renewal Reminder Poller...")
        self._task = asyncio.create_task(self._poll_loop())

    async def stop(self):
        self.is_running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("Renewal Reminder Poller stopped.")

    async def _poll_loop(self):
        while self.is_running:
            try:
                await asyncio.to_thread(self._process_renewals)
            except Exception as exc:
                logger.error(f"Error in renewal reminder poll loop: {exc}")
            await asyncio.sleep(self.poll_interval_seconds)

    def _process_renewals(self):
        db = SessionLocal()
        try:
            today = date.today()
            window_start = today + timedelta(days=1)
            window_end = today + timedelta(days=60)

            leads = (
                db.query(Lead)
                .filter(
                    Lead.leadType == "group",
                    Lead.renewalDate.isnot(None),
                    Lead.renewalDate >= window_start,
                    Lead.renewalDate <= window_end,
                    Lead.pipelineStatus.notin_(["closed_lost", "renewal_followup"]),
                )
                .all()
            )

            if not leads:
                return

            template = (
                db.query(MessageTemplate)
                .filter(
                    MessageTemplate.triggerStage == "renewal_followup",
                    MessageTemplate.isActive == True,
                )
                .first()
            )

            for lead in leads:
                days_until = (lead.renewalDate - today).days
                # Send at 60 days and 30 days before renewal
                if days_until not in (60, 30):
                    continue

                if template and lead.email:
                    try:
                        from app.api.v1.endpoints.templates import (
                            _build_variables_from_lead,
                            _render_template,
                        )

                        variables = _build_variables_from_lead(lead)
                        rendered_body = _render_template(template.body, variables)
                        rendered_subject = _render_template(
                            template.subject or "", variables
                        )

                        if template.type == "email":
                            communication_service.email_service.send_email(
                                lead.email, rendered_subject, rendered_body
                            )
                        elif template.type == "sms" and lead.phone:
                            communication_service.twilio_service.send_sms(
                                lead.phone, rendered_body
                            )

                        logger.info(
                            "Renewal reminder sent to %s (%s) - %d days until renewal",
                            lead.companyName or lead.email,
                            lead.id,
                            days_until,
                        )
                    except Exception as exc:
                        logger.error(
                            "Failed to send renewal reminder for lead %s: %s",
                            lead.id,
                            exc,
                        )

                # Move to renewal_followup pipeline
                if lead.pipelineStatus != "renewal_followup":
                    from app.models import PipelineHistory
                    import uuid

                    prev = lead.pipelineStatus
                    lead.pipelineStatus = "renewal_followup"
                    db.add(
                        PipelineHistory(
                            id=str(uuid.uuid4()),
                            leadId=lead.id,
                            fromStage=prev,
                            toStage="renewal_followup",
                            notes=f"Auto-moved: renewal date in {days_until} days",
                        )
                    )
                    db.commit()
        finally:
            db.close()


renewal_reminder_poller = RenewalReminderPoller()
