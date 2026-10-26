from context_api.models import Record
from context_api.pcr.resolver import Resolver
from context_api.sca.history import HistoryService
from context_api.sca.merge import merge
from context_api.sources.mock import MockSources
from tests.context_api.conftest import FIXTURES


def rec(id, day, sources, title="t"):
    return Record(id=id, date=day, title=title, status="completed", flags=[], sources=sources)


# ---------- merge (pure) ----------
def test_merge_prefers_sampro_notes_the_drive_and_counts_duplicates():
    merged, absorbed = merge(
        [rec("sampro-1", "2026-03-02", ["sampro"], "from sampro")],
        [rec("drive-1", "2026-03-02", ["shared_drive"]), rec("drive-2", "2026-03-02", ["shared_drive"]), rec("drive-3", "2024-02-09", ["shared_drive"])],
    )
    assert absorbed == 2
    assert [(r.date, r.sources) for r in merged] == [
        ("2026-03-02", ["sampro", "shared_drive"]),
        ("2024-02-09", ["shared_drive"]),
    ]
    assert merged[0].title == "from sampro"


def test_merge_collapses_duplicate_drive_rows_on_a_day_sampro_lacks():
    merged, absorbed = merge([], [rec("d1", "2024-02-09", ["shared_drive"]), rec("d2", "2024-02-09", ["shared_drive"])])
    assert len(merged) == 1 and absorbed == 1


# ---------- the service ----------
async def pointer_for(settings, pointers, sources):
    ctx = await Resolver(sources, settings, pointers).resolve("s_8f2")
    return ctx.zones.history.pointer


async def test_history_merges_both_sources(settings, pointers):
    sources = MockSources(FIXTURES)
    pointer = await pointer_for(settings, pointers, sources)
    msg = await HistoryService(sources, settings, pointers).fetch("s_8f2", pointer)
    assert msg.state == "ready" and msg.zone_id == "history" and msg.type == "zone_data"
    assert [r.date for r in msg.data] == ["2026-08-14", "2026-03-02", "2025-06-11", "2024-02-09", "2023-11-20"]
    by_date = {r.date: r for r in msg.data}
    assert by_date["2026-08-14"].sources == ["sampro"]  # the drive never logged it
    assert by_date["2024-02-09"].sources == ["shared_drive"]  # Sampro never logged it
    assert by_date["2026-03-02"].sources == ["sampro", "shared_drive"]
    assert by_date["2026-03-02"].flags == ["recurring issue"]
    assert by_date["2026-08-14"].title == "Compressor tripped on high pressure. Replaced discharge valve."
    assert msg.data_quality.deduplicated == 4 and msg.data_quality.dropped_undated == 1
    assert msg.data_quality.unavailable_sources == []


async def test_seq_increments_per_session(settings, pointers):
    sources = MockSources(FIXTURES)
    pointer = await pointer_for(settings, pointers, sources)
    service = HistoryService(sources, settings, pointers)
    assert (await service.fetch("s_8f2", pointer)).seq == 1
    assert (await service.fetch("s_8f2", pointer)).seq == 2


async def test_a_pointer_cannot_be_used_by_another_session_or_guessed(settings, pointers):
    sources = MockSources(FIXTURES)
    pointer = await pointer_for(settings, pointers, sources)
    service = HistoryService(sources, settings, pointers)
    assert await service.fetch("s_other", pointer) is None
    assert await service.fetch("s_8f2", "hist_s_8f2_E-9999") is None


async def test_one_source_down_still_delivers_the_other(settings, pointers):
    sources = MockSources(FIXTURES, {"shared_drive": "down"})
    pointer = await pointer_for(settings, pointers, MockSources(FIXTURES))
    msg = await HistoryService(sources, settings, pointers).fetch("s_8f2", pointer)
    assert msg.state == "ready" and len(msg.data) == 4
    assert msg.data_quality.unavailable_sources == ["shared_drive"]


async def test_both_sources_down_is_unavailable(settings, pointers):
    sources = MockSources(FIXTURES, {"shared_drive": "down", "sampro": "down"})
    pointer = await pointer_for(settings, pointers, MockSources(FIXTURES))
    msg = await HistoryService(sources, settings, pointers).fetch("s_8f2", pointer)
    assert msg.state == "unavailable" and msg.data == []
    assert sorted(msg.data_quality.unavailable_sources) == ["sampro", "shared_drive"]
