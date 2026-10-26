"""Extra mock sessions that exercise the states the main scenario (s_8f2) cannot:
empty zones (s_clear), volume, long text and finished steps (s_busy), and no active job (s_nojob)."""
import pytest

from context_api.pcr.resolver import Resolver
from context_api.sca.history import HistoryService
from context_api.sources.mock import MockSources
from tests.context_api.conftest import FIXTURES


def make(settings, pointers, faults=None):
    sources = MockSources(FIXTURES, faults)
    return Resolver(sources, settings, pointers), HistoryService(sources, settings, pointers)


# ---------- s_clear: everything is fine, so most zones are empty ----------
@pytest.fixture
async def clear(settings, pointers):
    resolver, history = make(settings, pointers)
    ctx = await resolver.resolve("s_clear")
    return ctx, history


async def test_clear_job_has_empty_alerts_and_steps_but_ready_zones(clear):
    ctx, _ = clear
    assert ctx.worker.name == "Priya Raman"
    assert ctx.active_work_order.id == "WO-4502"
    assert ctx.zones.alerts.state == "ready" and ctx.zones.alerts.data == []
    assert ctx.zones.steps.state == "ready" and ctx.zones.steps.data == []
    assert ctx.degraded_fields == []


async def test_clear_job_work_order_is_fresh_and_has_no_sla_row(clear):
    ctx, _ = clear
    assert ctx.zones.work_order.state == "ready"
    labels = [f.label for f in ctx.zones.work_order.data.fields]
    assert "Client SLA" not in labels  # no portal ticket: an empty state, not an error
    assert ctx.zones.work_order.data.title == "Routine quarterly inspection - walk-in freezer"


async def test_clear_job_can_be_closed(clear):
    ctx, _ = clear
    close = next(a for a in ctx.zones.actions.data if a.name == "closeJob")
    assert close.enabled is True


async def test_clear_job_history_is_ready_but_empty(clear):
    ctx, history = clear
    message = await history.fetch("s_clear", ctx.zones.history.pointer)
    assert message.state == "ready" and message.data == []


# ---------- s_busy: volume, long text, done steps ----------
@pytest.fixture
async def busy(settings, pointers):
    resolver, history = make(settings, pointers)
    ctx = await resolver.resolve("s_busy")
    return ctx, history


async def test_busy_job_has_ten_ranked_alerts(busy):
    ctx, _ = busy
    alerts = ctx.zones.alerts.data
    assert [a.severity for a in alerts] == ["critical"] * 2 + ["warning"] * 5 + ["info"] * 3
    assert [a.id for a in alerts] == [f"a{i}" for i in range(1, 11)]


async def test_busy_job_alert_variants(busy):
    ctx, _ = busy
    by_message = {a.message: a for a in ctx.zones.alerts.data}
    assert "This equipment has failed 4 times in the past 12 months." in by_message
    bearing = by_message["Bearing assembly centrifugal compressor (BRG-880) is not in your van (0 on hand)."]
    assert bearing.suggestion.startswith("BRG-882 (3 on hand) was used as a substitute on 2026-06-03")
    sensor = by_message["Evaporator pressure sensor (SNS-12) is not in your van (0 on hand)."]
    assert sensor.suggestion == "SNS-14 (2 on hand) is a listed substitute."
    assert by_message["Oil cooler gasket kit (GSK-77) is not in your van (0 on hand)."].suggestion is None
    assert by_message["Expansion valve actuator (VLV-410) is not in your van (0 on hand)."].suggestion is None
    assert not any("OIL-5G" in m for m in by_message)  # one in the van: no alert


async def test_busy_job_steps_mix_done_current_and_todo(busy):
    ctx, _ = busy
    steps = ctx.zones.steps.data
    assert len(steps) == 5 + 14
    assert [s.source for s in steps] == ["sitedocs"] * 5 + ["xoi"] * 14
    statuses = [s.status for s in steps]
    assert statuses.count("current") == 1
    assert statuses[0] == "done" and statuses[1] == "current"  # JSA done, expired confined space permit is next
    assert statuses[3] == "done"  # lockout verification
    assert statuses[5:10] == ["done"] * 5 and set(statuses[10:]) == {"todo"}
    assert {s.kind for s in steps} == {"confirm", "photo", "question", "guide"}
    assert max(len(s.label) for s in steps) > 80  # long labels to wrap


async def test_busy_job_cannot_be_closed_yet_and_has_long_text(busy):
    ctx, _ = busy
    close = next(a for a in ctx.zones.actions.data if a.name == "closeJob")
    assert close.enabled is False
    assert len(ctx.active_work_order.task_summary) > 150
    assert ctx.zones.work_order.state == "ready"  # synced two hours ago, not stale
    assert {f.label for f in ctx.zones.work_order.data.fields} >= {"Client SLA"}


async def test_busy_job_history_is_long_and_messy(busy):
    ctx, history = busy
    message = await history.fetch("s_busy", ctx.zones.history.pointer)
    assert len(message.data) == 28
    assert message.data_quality.deduplicated == 3
    assert message.data_quality.dropped_undated == 1
    dates = [r.date for r in message.data]
    assert dates == sorted(dates, reverse=True)


# ---------- s_nojob: logged in, not on a job ----------
async def test_worker_with_no_active_job_gets_an_empty_but_healthy_context(settings, pointers):
    resolver, _ = make(settings, pointers)
    ctx = await resolver.resolve("s_nojob")
    assert ctx.worker.name == "Owen Park"
    assert ctx.active_work_order is None
    assert ctx.layout.template_id == "technician.v1"
    assert ctx.zones.alerts.state == "ready" and ctx.zones.alerts.data == []
    assert ctx.zones.work_order.state == "ready" and ctx.zones.work_order.data is None
    assert ctx.zones.steps.state == "ready" and ctx.zones.steps.data == []
    assert ctx.zones.actions.state == "ready" and ctx.zones.actions.data == []
    assert ctx.zones.history.state == "ready" and ctx.zones.history.pointer is None
    assert [(s.system, s.state) for s in ctx.connection_status] == [("sampro", "live")]
    assert ctx.degraded_fields == []


async def test_no_active_job_with_sampro_down_is_still_a_real_outage(settings, pointers):
    resolver, _ = make(settings, pointers, {"sampro": "down"})
    ctx = await resolver.resolve("s_nojob")
    assert ctx.connection_status[0].state == "down"
    assert ctx.zones.work_order.state == "unavailable"
