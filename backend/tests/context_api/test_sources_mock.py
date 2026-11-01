import asyncio

import pytest

from context_api.sources.base import SourceUnavailable
from context_api.sources.mock import LOGIN_PAGE, MockSources
from tests.context_api.conftest import FIXTURES


async def test_returns_raw_records(sources):
    wo = await sources.work_order(4471)
    assert wo["eq_id"] == "E-2231" and wo["po_no"] == "NG-PO-88217"
    assert (await sources.xtreme_work_order("4471"))["jobId"] == "JOB-2026-004471"
    assert len(await sources.service_history("E-2231")) == 4
    assert len(await sources.drive_history()) == 15


async def test_missing_records_are_none_or_empty(sources):
    assert await sources.work_order(1) is None
    assert await sources.service_history("E-9999") == []


async def test_part_usage_finds_service_rows(sources):
    rows = await sources.part_usage("V-224")
    assert [r["svc_id"] for r in rows] == [8702]


async def test_certs_are_filtered_by_worker(sources):
    assert len(await sources.sitedocs_certs("T0042")) == 3
    assert await sources.sitedocs_certs("nobody") == []


async def test_down_fault_raises():
    src = MockSources(FIXTURES, {"sitedocs": "down"})
    with pytest.raises(SourceUnavailable):
        await src.sitedocs_required()
    assert await src.xoi_workflows()  # other systems are unaffected


async def test_slow_fault_exceeds_a_timeout():
    src = MockSources(FIXTURES, {"xtreme": "slow"})
    with pytest.raises(asyncio.TimeoutError):
        await asyncio.wait_for(src.xtreme_work_order("4471"), 0.05)


async def test_login_wall_returns_html_instead_of_data():
    src = MockSources(FIXTURES, {"client_portal": "login_wall"})
    assert await src.portal_ticket("NG-PO-88217") == LOGIN_PAGE


async def test_xoi_progress_lists_completed_steps_per_job(sources):
    assert await sources.xoi_progress(4510) == [1, 2, 3, 4, 5]
    assert await sources.xoi_progress(4471) == []


async def test_xoi_progress_follows_the_xoi_fault():
    src = MockSources(FIXTURES, {"xoi": "down"})
    with pytest.raises(SourceUnavailable):
        await src.xoi_progress(4510)
