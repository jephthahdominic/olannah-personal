"""Persona Context Resolver: builds the ContextObject for one session.

Flow: identify -> stage 1 (work order, tech, parts catalog) -> stage 2 (everything else, in parallel,
each call individually timed out) -> correlate -> run alert rules -> assemble zones.
A failed source degrades only the zones that need it.
"""
import asyncio
from datetime import datetime, timedelta
from typing import Optional

from context_api.adapters import portal as portal_adapter
from context_api.adapters import sampro as sampro_adapter
from context_api.adapters import sitedocs as sitedocs_adapter
from context_api.adapters import xoi as xoi_adapter
from context_api.adapters import xtreme as xtreme_adapter
from context_api.config import SYSTEM_WRITE_BACK, Settings
from context_api.models import (
    Action,
    ActionsZone,
    ActiveWorkOrder,
    Alert,
    AlertsZone,
    ContextObject,
    DegradedField,
    Entity,
    EntityField,
    HistoryZone,
    Step,
    StepsZone,
    SystemStatus,
    WorkOrderZone,
    Worker,
    Zones,
)
from context_api.normalize import parse_yyyymmdd, sentence_case
from context_api.pcr import alert_rules
from context_api.pcr.identity import identify
from context_api.pcr.persona_registry import ROLE_LABELS, layout_for
from context_api.pcr.pointers import PointerStore
from context_api.pcr.safe import Outcome, call
from context_api.sources.base import SourceUnavailable, Sources

SCHEMA_VERSION = "1.0"
_SAMPRO_KEYS = ("customer", "site", "equipment", "history", "van")


async def _missing() -> None:
    raise SourceUnavailable("sampro")


class Resolver:
    def __init__(self, sources: Sources, settings: Settings, pointers: PointerStore):
        self.sources = sources
        self.settings = settings
        self.pointers = pointers

    async def resolve(self, session_id: str) -> Optional[ContextObject]:
        ident = identify(session_id)
        if ident is None:
            return None  # role cannot be determined -> the API answers 404

        now = self.settings.clock()
        timeout = self.settings.source_timeout
        s = self.sources
        layout, degraded = layout_for(ident.role)

        if ident.wo_no is None:
            return await self._idle(session_id, ident, now, layout, degraded)

        # ---- stage 1: independent of each other ----
        wo_call = s.work_order(ident.wo_no)
        wo_out, tech_out, parts_out = await asyncio.gather(
            call(wo_call, timeout), call(s.tech(ident.worker_id), timeout), call(s.parts(), timeout)
        )
        worker = Worker(
            id=ident.worker_id,
            name=(tech_out.value["tech_nm"].title() if tech_out.ok and tech_out.value else ident.worker_id),
            role_label=ROLE_LABELS.get(ident.role, ident.role.title()),
        )
        wo = wo_out.value if wo_out.ok else None
        if wo is None:
            return self._without_work_order(session_id, now, worker, layout, degraded)

        # ---- stage 2: everything else, in parallel ----
        van_id = tech_out.value.get("van_id") if tech_out.ok and tech_out.value else None
        catalog = {p["part_id"]: p for p in parts_out.value} if parts_out.ok else {}
        alts = sorted(
            {catalog[p]["alt_part_id"] for p in wo["req_parts"] if p in catalog and catalog[p].get("alt_part_id")}
        )
        calls = {
            "customer": s.customer(wo["cust_id"]),
            "site": s.site(wo["site_id"]),
            "equipment": s.equipment(wo["eq_id"]),
            "xtreme": s.xtreme_work_order(str(wo["wo_no"])),
            "history": s.service_history(wo["eq_id"]),
            "van": s.van_inventory(van_id) if van_id else _missing(),
            "xoi": s.xoi_workflows(),
            "progress": s.xoi_progress(wo["wo_no"]),
            "sd_docs": s.sitedocs_required(),
            "sd_certs": s.sitedocs_certs(ident.worker_id),
            "portal": s.portal_ticket(wo["po_no"]),
        }
        for alt in alts:
            calls[f"usage:{alt}"] = s.part_usage(alt)
        results = await asyncio.gather(*[call(c, timeout) for c in calls.values()])
        out: dict[str, Outcome] = dict(zip(calls, results))

        # ---- correlate: one job, many systems ----
        job = xtreme_adapter.parse_job(out["xtreme"].value) if out["xtreme"].ok and out["xtreme"].value else None
        ticket, portal_ok = None, out["portal"].ok
        if portal_ok:
            try:
                ticket = portal_adapter.parse_ticket(out["portal"].value)
            except SourceUnavailable:
                portal_ok = False  # HTTP 200 with a login page counts as down

        sampro_customer = out["customer"].value if out["customer"].ok and out["customer"].value else None
        sampro_site = out["site"].value if out["site"].ok and out["site"].value else None
        customer_name = (job.customer_name if job else None) or (
            sampro_customer["cust_nm"].title() if sampro_customer else None
        )
        site_name = (job.site_name if job else None) or (sampro_site["site_nm"].title() if sampro_site else None)
        equipment = out["equipment"].value if out["equipment"].ok and out["equipment"].value else None

        # ---- connection status ----
        sampro_ok = (
            wo_out.ok
            and tech_out.ok
            and parts_out.ok
            and all(out[k].ok for k in _SAMPRO_KEYS)
            and all(o.ok for k, o in out.items() if k.startswith("usage:"))
        )
        sitedocs_ok = out["sd_docs"].ok and out["sd_certs"].ok
        states = {
            "sampro": "live" if sampro_ok else "down",
            "xtreme": "live" if out["xtreme"].ok else "down",
            "xoi": "live" if out["xoi"].ok and out["progress"].ok else "down",
            "sitedocs": "live" if sitedocs_ok else "down",
            "client_portal": "read_only" if portal_ok else "down",
        }
        connection_status = [
            SystemStatus(
                system=name,
                state=state,
                write_back=SYSTEM_WRITE_BACK[name],
                last_synced=job.last_synced.isoformat() if name == "xtreme" and job and job.last_synced else None,
            )
            for name, state in states.items()
        ]
        degraded = degraded + [
            DegradedField(field=f"source.{name}", reason="unavailable")
            for name, state in states.items()
            if state == "down"
        ]

        # ---- alerts ----
        today = now.date()
        history = sampro_adapter.history_records(out["history"].value)[0] if out["history"].ok else []
        alerts: list[Alert] = alert_rules.recurring_failure(history, today)
        if out["van"].ok and parts_out.ok and van_id:
            usage = {a: out[f"usage:{a}"].value or [] for a in alts if out[f"usage:{a}"].ok}
            stock = sampro_adapter.stock_by_part(out["van"].value)
            alerts += alert_rules.missing_parts(wo["req_parts"], stock, catalog, usage, van_id)
        docs = (
            sitedocs_adapter.required_documents(out["sd_docs"].value, site_name)
            if out["sd_docs"].ok and site_name
            else []
        )
        certs = sitedocs_adapter.certifications(out["sd_certs"].value) if out["sd_certs"].ok else []
        alerts += alert_rules.safety_documents(docs, site_name or "this site")
        alerts += alert_rules.expiring_certs(certs, today)
        alert_inputs_ok = any(out[k].ok for k in ("history", "van", "sd_docs", "sd_certs"))
        alerts_zone = (
            AlertsZone(state="ready", as_of=now.isoformat(), data=alert_rules.rank(alerts))
            if alert_inputs_ok
            else AlertsZone(state="unavailable")
        )

        # ---- work order ----
        scheduled_day = parse_yyyymmdd(wo.get("sched_dt"))
        tm = wo.get("sched_tm") or ""
        scheduled = f"{scheduled_day:%Y-%m-%d} {tm[:2]}:{tm[2:]}" if scheduled_day and len(tm) == 4 else "Unknown"
        fields = [
            EntityField(label="Customer", value=customer_name or "Unknown"),
            EntityField(label="Site", value=site_name or "Unknown"),
            EntityField(label="Scheduled", value=scheduled),
            EntityField(label="PO", value=wo.get("po_no") or "None"),
        ]
        if ticket and ticket.respond_by and ticket.resolve_by:
            fields.append(
                EntityField(
                    label="Client SLA",
                    value=f"Respond by {ticket.respond_by:%Y-%m-%d %H:%M}, resolve by {ticket.resolve_by:%Y-%m-%d %H:%M}",
                )
            )
        description = sentence_case(wo.get("wo_desc")) or "Work order"
        stale = (
            job is not None
            and job.last_synced is not None
            and now - job.last_synced > timedelta(hours=self.settings.stale_after_hours)
        )
        work_order_zone = WorkOrderZone(
            state="stale" if stale else "ready",
            as_of=job.last_synced.isoformat() if stale else now.isoformat(),
            data=Entity(id=f"WO-{wo['wo_no']}", title=description, fields=fields),
        )

        # ---- steps ----
        # (kind, label, required, source, done)
        step_specs: list[tuple[str, str, bool, str, bool]] = []
        for doc in sorted(docs, key=lambda d: 0 if d.must_complete_by == "ON_ARRIVAL" else 1):
            if doc.must_complete_by not in ("ON_ARRIVAL", "BEFORE_WORK"):
                continue
            if doc.status in ("EXPIRED", "REQUIRED"):
                label = f"Complete {doc.title}"
                if doc.status == "EXPIRED":
                    label += f" again (expired {doc.expires_on:%m/%d/%Y})" if doc.expires_on else " again"
                step_specs.append(("confirm", label, True, "sitedocs", False))
            elif doc.status == "COMPLETED":
                step_specs.append(("confirm", f"Complete {doc.title}", True, "sitedocs", True))
        xoi_ok = out["xoi"].ok and out["progress"].ok and equipment is not None and customer_name is not None
        if xoi_ok:
            finished = set(out["progress"].value or [])
            for step in xoi_adapter.pick_steps(out["xoi"].value, customer_name, equipment["eq_type"]):
                step_specs.append((step.kind, step.label, step.required, "xoi", step.seq in finished))
        steps_ok = (out["sd_docs"].ok and site_name is not None) or xoi_ok
        first_open = next((i for i, spec in enumerate(step_specs) if not spec[4]), None)
        steps = [
            Step(
                id=f"st{i}",
                kind=kind,
                label=label,
                status="done" if done else ("current" if i - 1 == first_open else "todo"),
                required=required,
                source=source,
            )
            for i, (kind, label, required, source, done) in enumerate(step_specs, start=1)
        ]
        steps_zone = (
            StepsZone(state="ready", as_of=now.isoformat(), data=steps) if steps_ok else StepsZone(state="unavailable")
        )

        # ---- actions ----
        write_back = "auto" if SYSTEM_WRITE_BACK["sampro"] else "manual"
        close_enabled = steps_ok and not any(st.required and st.status != "done" for st in steps)
        actions_zone = ActionsZone(
            state="ready",
            as_of=now.isoformat(),
            data=[
                Action(name="closeJob", label="Close job", enabled=close_enabled, write_back=write_back, needs_checkpoint=True),
                Action(name="requestPart", label="Request part", enabled=True, write_back=write_back, needs_checkpoint=False),
            ],
        )

        # ---- history is delivered later by the aggregator; we hand over a pointer ----
        history_zone = HistoryZone(state="loading", pointer=self.pointers.issue(session_id, wo["eq_id"]))

        return ContextObject(
            schema_version=SCHEMA_VERSION,
            session_id=session_id,
            delivered_at=now.isoformat(),
            worker=worker,
            layout=layout,
            active_work_order=ActiveWorkOrder(
                id=f"WO-{wo['wo_no']}", site_name=site_name or "Unknown", task_summary=description
            ),
            connection_status=connection_status,
            zones=Zones(
                alerts=alerts_zone,
                work_order=work_order_zone,
                steps=steps_zone,
                actions=actions_zone,
                history=history_zone,
            ),
            degraded_fields=degraded,
        )

    async def _idle(self, session_id, ident, now: datetime, layout, degraded) -> ContextObject:
        """Logged in but not on a job: a healthy, empty workspace (not an outage)."""
        tech_out = await call(self.sources.tech(ident.worker_id), self.settings.source_timeout)
        name = tech_out.value["tech_nm"].title() if tech_out.ok and tech_out.value else ident.worker_id
        worker = Worker(id=ident.worker_id, name=name, role_label=ROLE_LABELS.get(ident.role, ident.role.title()))
        if not tech_out.ok:
            return self._without_work_order(session_id, now, worker, layout, degraded)
        stamp = now.isoformat()
        return ContextObject(
            schema_version=SCHEMA_VERSION,
            session_id=session_id,
            delivered_at=stamp,
            worker=worker,
            layout=layout,
            active_work_order=None,
            connection_status=[SystemStatus(system="sampro", state="live", write_back=SYSTEM_WRITE_BACK["sampro"])],
            zones=Zones(
                alerts=AlertsZone(state="ready", as_of=stamp),
                work_order=WorkOrderZone(state="ready", as_of=stamp),
                steps=StepsZone(state="ready", as_of=stamp),
                actions=ActionsZone(state="ready", as_of=stamp),
                history=HistoryZone(state="ready"),  # no pointer: there is no equipment to load history for
            ),
            degraded_fields=degraded,
        )

    def _without_work_order(self, session_id, now: datetime, worker, layout, degraded) -> ContextObject:
        """Sampro (the system of record) is unreachable or there is no active job: nothing to build on."""
        return ContextObject(
            schema_version=SCHEMA_VERSION,
            session_id=session_id,
            delivered_at=now.isoformat(),
            worker=worker,
            layout=layout,
            active_work_order=None,
            connection_status=[
                SystemStatus(system="sampro", state="down", write_back=SYSTEM_WRITE_BACK["sampro"])
            ],
            zones=Zones(
                alerts=AlertsZone(state="unavailable"),
                work_order=WorkOrderZone(state="unavailable"),
                steps=StepsZone(state="unavailable"),
                actions=ActionsZone(
                    state="ready",
                    as_of=now.isoformat(),
                    data=[Action(name="closeJob", label="Close job", enabled=False, write_back="manual", needs_checkpoint=True)],
                ),
                history=HistoryZone(state="unavailable"),
            ),
            degraded_fields=degraded + [DegradedField(field="work_order", reason="unavailable")],
        )
