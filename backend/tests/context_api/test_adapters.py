import csv
from datetime import date

import pytest

from context_api.adapters import drive, portal, sampro, sitedocs, xoi, xtreme
from context_api.sources.base import SourceUnavailable
from tests.context_api.conftest import FIXTURES, load_json


# ---------- Sampro ----------
def test_sampro_history_maps_codes_flags_and_sentence_case():
    rows = load_json("sampro-mock.json")["service_history"]
    records, dropped = sampro.history_records([r for r in rows if r["eq_id"] == "E-2231"])
    assert dropped == 0
    by_id = {r.id: r for r in records}
    assert by_id["sampro-8841"].date == "2026-08-14"
    assert by_id["sampro-8841"].status == "completed"
    assert by_id["sampro-8841"].flags == ["recurring issue"]
    assert by_id["sampro-8841"].title == "Compressor tripped on high pressure. Replaced discharge valve."
    assert by_id["sampro-7502"].flags == []


def test_sampro_history_survives_the_edge_cases():
    rows = load_json("sampro-mock.json")["edge_cases"]["service_history"]
    records, dropped = sampro.history_records(rows)
    assert dropped == 2  # bad-date and missing-date rows
    by_id = {r.id: r for r in records}
    assert by_id["sampro-9001"].title == "(no description)"
    assert by_id["sampro-9002"].status == "unknown"


def test_sampro_stock_clamps_negative_quantities():
    edge = load_json("sampro-mock.json")["edge_cases"]["van_inventory"]
    assert sampro.stock_by_part(edge) == {"CT-30": 0}


# ---------- shared drive ----------
def _drive_rows():
    with (FIXTURES / "shared-drive-history.csv").open(newline="") as handle:
        return list(csv.DictReader(handle))


def test_drive_matches_equipment_typed_four_ways_and_drops_undated():
    records, dropped = drive.history_records(_drive_rows(), "E-2231")
    assert dropped == 1
    assert sorted(r.date for r in records) == ["2023-11-20", "2024-02-09", "2025-06-11", "2026-03-02", "2026-03-02"]
    assert all(r.sources == ["shared_drive"] for r in records)


def test_drive_ignores_other_equipment():
    records, _ = drive.history_records(_drive_rows(), "E-3340")
    assert [r.date for r in records] == ["2026-09-18"]


# ---------- SiteDocs ----------
def test_sitedocs_filters_by_site_and_parses_dates():
    rows = load_json("sitedocs.json")["required_documents"]
    docs = {d.doc_id: d for d in sitedocs.required_documents(rows, "Store 118")}
    assert set(docs) == {"SD-55021", "SD-55022", "SD-55023"}
    assert docs["SD-55021"].status == "EXPIRED"
    assert docs["SD-55021"].expires_on == date(2026, 10, 12)
    assert docs["SD-55022"].expires_on is None


def test_sitedocs_site_name_variants_and_bad_data():
    edge = load_json("sitedocs.json")["edge_cases"]
    rows = [edge["bad_date"], edge["unknown_status"], edge["site_name_mismatch"]]
    docs = {d.doc_id: d for d in sitedocs.required_documents(rows, "Store 118")}
    assert set(docs) == {"SD-99001", "SD-99002", "SD-99003"}  # "STORE #118" still matches
    assert docs["SD-99001"].expires_on is None  # nothing crashes on a bad date
    assert docs["SD-99002"].status == "IN_REVIEW"


def test_sitedocs_certifications():
    certs = sitedocs.certifications(load_json("sitedocs.json")["worker_certifications"])
    loto = next(c for c in certs if c.name.startswith("Lockout"))
    assert loto.status == "VALID" and loto.expires_on == date(2026, 11, 2)


# ---------- XOi ----------
def test_xoi_picks_highest_version_despite_name_case():
    workflows = load_json("xoi.json")["workflows"]
    steps = xoi.pick_steps(workflows, "Northfield Grocers", "COMP-SCR")
    assert [s.label for s in steps][:2] == ["Check in at receiving dock", "Photo of compressor nameplate"]
    assert len(steps) == 6
    assert [s.required for s in steps][3] is False  # the troubleshooting guide is optional


def test_xoi_skips_unknown_kinds_and_untitled_steps():
    base = load_json("xoi.json")
    edge = base["edge_cases"]
    workflow = {**base["workflows"][0], "steps": base["workflows"][0]["steps"] + [edge["unknown_step_type"], edge["missing_title"]]}
    assert len(xoi.pick_steps([workflow], "NORTHFIELD GROCERS", "COMP-SCR")) == 6


def test_xoi_no_workflow_for_customer_or_equipment():
    workflows = load_json("xoi.json")["workflows"]
    assert xoi.pick_steps(workflows, "SOME OTHER CLIENT", "COMP-SCR") == []
    assert xoi.pick_steps(workflows, "Northfield Grocers", "BOILER") == []


# ---------- Xtreme ----------
def test_xtreme_parse_job():
    raw = load_json("xtreme.json")["workOrders"][0]
    job = xtreme.parse_job(raw)
    assert job.site_name == "Store 118"
    assert job.last_synced.isoformat() == "2026-10-22T16:40:00-05:00"


def test_xtreme_tolerates_the_edge_case_record():
    job = xtreme.parse_job(load_json("xtreme.json")["edge_cases"]["workOrders"][0])
    assert job.scheduled_start is None  # "not-a-date"
    assert job.site_name == "Store 118"


# ---------- client portal ----------
def test_portal_parse_ticket():
    ticket = portal.parse_ticket(load_json("client-portal.json")["tickets"][0])
    assert ticket.ticket == "NG-T-220931"
    assert ticket.respond_by.hour == 12


def test_portal_none_is_an_empty_state_not_an_error():
    assert portal.parse_ticket(None) is None


def test_portal_login_page_is_an_outage():
    with pytest.raises(SourceUnavailable):
        portal.parse_ticket("<html>Please sign in to continue</html>")
