"""The acceptance tests: the PCR turns the six mock systems into the expected context object,
and degrades only the affected zones when a system fails."""
import pytest

from context_api.pcr.resolver import Resolver
from context_api.sources.mock import MockSources
from tests.context_api.conftest import FIXTURES


def make(settings, pointers, faults=None) -> Resolver:
    return Resolver(MockSources(FIXTURES, faults), settings, pointers)


@pytest.fixture
async def ctx(settings, pointers):
    return await make(settings, pointers).resolve("s_8f2")


# ---------- the happy path: Marcus, Store 118, 2026-10-23 08:00 ----------
async def test_header_layout_and_worker(ctx):
    assert ctx.schema_version == "1.0"
    assert ctx.delivered_at == "2026-10-23T08:00:03-05:00"
    assert ctx.worker.name == "Marcus Allen" and ctx.worker.role_label == "Field Technician"
    assert ctx.layout_config.template_id == "technician.v1"
    assert ctx.active_work_order.id == "WO-4471"
    assert ctx.active_work_order.site_name == "Store 118"
    assert ctx.degraded_fields == []


async def test_context_carries_the_resolved_role(ctx):
    assert ctx.resolved_role == "technician"


async def test_unmapped_role_keeps_its_resolved_role(settings, pointers):
    ctx = await make(settings, pointers).resolve("s_unmapped")
    assert ctx.resolved_role == "dispatcher"


async def test_alerts_are_ranked_and_evidenced(ctx):
    zone = ctx.zones.alerts
    assert zone.state == "rendered"
    assert [(a.id, a.severity) for a in zone.data] == [("a1", "critical"), ("a2", "warning"), ("a3", "warning"), ("a4", "info")]
    assert zone.data[0].message == "Job Safety Analysis (JSA) for Store 118 expired 10/12/2026. Complete it again on arrival."
    assert zone.data[1].message == "This equipment has failed twice in the past 12 months."
    assert zone.data[2].message == "Discharge valve ZR72 (V-221) is not in your van (0 on hand)."
    assert zone.data[2].suggestion == "V-224 (2 on hand) was used as a substitute on 2026-09-18 (service 8702)."
    assert zone.data[3].message == "Your Lockout/Tagout Authorized certification expires 11/02/2026."


async def test_work_order_reports_the_xtreme_sync_time_as_its_freshness(ctx):
    zone = ctx.zones.work_order
    assert zone.state == "rendered"  # never "stale": the canvas derives that from refresh timing (BRD SR 16)
    assert zone.as_of == "2026-10-22T16:40:00-05:00"
    fields = {f.label: f.value for f in zone.data.fields}
    assert fields["Customer"] == "Northfield Grocers"
    assert fields["Site"] == "Store 118"
    assert fields["Scheduled"] == "2026-10-23 08:00"
    assert fields["PO"] == "NG-PO-88217"
    assert fields["Client SLA"] == "Respond by 2026-10-23 12:00, resolve by 2026-10-24 08:00"


async def test_steps_put_safety_first_then_the_client_workflow(ctx):
    steps = ctx.zones.steps.data
    assert [s.source for s in steps] == ["sitedocs", "sitedocs"] + ["xoi"] * 6
    assert steps[0].label == "Complete Job Safety Analysis (JSA) again (expired 10/12/2026)"
    assert steps[1].label == "Complete Lockout/Tagout Verification"
    assert steps[2].label == "Check in at receiving dock"
    assert [s.status for s in steps] == ["current"] + ["todo"] * 7


async def test_actions_are_manual_and_close_job_is_disabled(ctx):
    actions = {a.name: a for a in ctx.zones.actions.data}
    assert actions["closeJob"].enabled is False and actions["closeJob"].needs_checkpoint is True
    assert actions["requestPart"].enabled is True
    assert {a.write_back for a in actions.values()} == {"manual"}


async def test_history_is_a_pointer_not_data(ctx):
    assert ctx.zones.history.state == "loading"
    assert ctx.zones.history.pointer == "hist_s_8f2_E-2231"


async def test_connection_status(ctx):
    status = {s.system: s for s in ctx.connection_status}
    assert {k: v.state for k, v in status.items()} == {
        "sampro": "live", "xtreme": "live", "xoi": "live", "sitedocs": "live", "client_portal": "read_only"
    }
    assert all(v.write_back is False for v in status.values())
    assert status["xtreme"].last_synced == "2026-10-22T16:40:00-05:00"


# ---------- identity and layout ----------
async def test_unknown_session_resolves_to_none(settings, pointers):
    assert await make(settings, pointers).resolve("s_nope") is None


async def test_unmapped_role_gets_the_default_layout_and_a_flag(settings, pointers):
    ctx = await make(settings, pointers).resolve("s_unmapped")
    assert ctx.layout_config.template_id == "platform.default.v1"
    assert any(d.field == "layout" and d.reason == "unmapped_role" for d in ctx.degraded_fields)


# ---------- failure drills: one system down, only its zones degrade ----------
async def test_sitedocs_down_removes_safety_alerts_and_steps_but_nothing_else(settings, pointers):
    ctx = await make(settings, pointers, {"sitedocs": "down"}).resolve("s_8f2")
    assert ctx.zones.alerts.state == "rendered"
    assert [a.severity for a in ctx.zones.alerts.data] == ["warning", "warning"]  # no JSA, no cert
    assert ctx.zones.steps.state == "rendered"
    assert [s.source for s in ctx.zones.steps.data] == ["xoi"] * 6
    assert {s.system: s.state for s in ctx.connection_status}["sitedocs"] == "down"
    assert any(d.field == "source.sitedocs" for d in ctx.degraded_fields)


async def test_sitedocs_and_xoi_down_makes_steps_unavailable(settings, pointers):
    ctx = await make(settings, pointers, {"sitedocs": "down", "xoi": "down"}).resolve("s_8f2")
    assert ctx.zones.steps.state == "unavailable"
    assert ctx.zones.steps.data == []
    assert ctx.zones.actions.data[0].enabled is False
    assert ctx.zones.work_order.state == "rendered"  # unrelated zones are untouched


async def test_slow_xtreme_times_out_and_work_order_falls_back_to_sampro(settings, pointers):
    ctx = await make(settings, pointers, {"xtreme": "slow"}).resolve("s_8f2")
    assert {s.system: s.state for s in ctx.connection_status}["xtreme"] == "down"
    assert ctx.zones.work_order.state == "rendered"
    assert ctx.zones.work_order.as_of == "2026-10-23T08:00:03-05:00"  # no Xtreme sync time, so "as of now"
    assert {f.label: f.value for f in ctx.zones.work_order.data.fields}["Site"] == "Store 118"  # from Sampro


async def test_portal_login_page_counts_as_down_and_drops_the_sla(settings, pointers):
    ctx = await make(settings, pointers, {"client_portal": "login_wall"}).resolve("s_8f2")
    assert {s.system: s.state for s in ctx.connection_status}["client_portal"] == "down"
    assert "Client SLA" not in {f.label for f in ctx.zones.work_order.data.fields}


async def test_sampro_down_returns_a_minimal_context_instead_of_failing(settings, pointers):
    ctx = await make(settings, pointers, {"sampro": "down"}).resolve("s_8f2")
    assert ctx.active_work_order is None
    assert ctx.zones.alerts.state == ctx.zones.work_order.state == ctx.zones.steps.state == "unavailable"
    assert ctx.zones.history.state == "unavailable" and ctx.zones.history.pointer is None
    assert ctx.zones.actions.data[0].enabled is False
    assert any(d.field == "work_order" for d in ctx.degraded_fields)
