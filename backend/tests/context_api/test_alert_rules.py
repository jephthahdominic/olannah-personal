from datetime import date

from context_api.adapters.sitedocs import Cert, SiteDoc
from context_api.models import Alert, Record
from context_api.pcr import alert_rules

TODAY = date(2026, 10, 23)


def failure(svc_id: int, day: str) -> Record:
    return Record(id=f"sampro-{svc_id}", date=day, title="x", status="completed",
                  flags=["recurring issue"], sources=["sampro"])


def test_two_failures_in_twelve_months_raise_one_warning():
    alerts = alert_rules.recurring_failure([failure(8310, "2026-03-02"), failure(8841, "2026-08-14")], TODAY)
    assert len(alerts) == 1
    assert alerts[0].message == "This equipment has failed twice in the past 12 months."
    assert [e.ref for e in alerts[0].evidence] == ["svc 8310", "svc 8841"]


def test_old_or_single_failures_do_not_alert():
    assert alert_rules.recurring_failure([failure(1, "2026-03-02")], TODAY) == []
    assert alert_rules.recurring_failure([failure(1, "2024-01-01"), failure(2, "2025-01-01")], TODAY) == []


def test_missing_part_suggests_an_in_stock_substitute():
    catalog = {"V-221": {"part_id": "V-221", "part_desc": "DISCHARGE VALVE ZR72", "alt_part_id": "V-224"}}
    usage = {"V-224": [{"svc_id": 8702, "svc_dt": "20260918"}]}
    alerts = alert_rules.missing_parts(["V-221"], {"V-221": 0, "V-224": 2}, catalog, usage, "VAN-07")
    assert len(alerts) == 1
    assert alerts[0].message == "Discharge valve ZR72 (V-221) is not in your van (0 on hand)."
    assert alerts[0].suggestion == "V-224 (2 on hand) was used as a substitute on 2026-09-18 (service 8702)."


def test_in_stock_parts_do_not_alert_and_no_substitute_means_no_suggestion():
    assert alert_rules.missing_parts(["FLT-10"], {"FLT-10": 5}, {}, {}, "VAN-07") == []
    alerts = alert_rules.missing_parts(["X-1"], {}, {"X-1": {"part_desc": "WIDGET", "alt_part_id": None}}, {}, "VAN-07")
    assert alerts[0].suggestion is None


def test_only_expired_documents_are_critical():
    docs = [
        SiteDoc("SD-1", "Job Safety Analysis (JSA)", "EXPIRED", "ON_ARRIVAL", date(2026, 10, 12)),
        SiteDoc("SD-2", "Lockout/Tagout Verification", "REQUIRED", "BEFORE_WORK", None),
    ]
    alerts = alert_rules.safety_documents(docs, "Store 118")
    assert [a.severity for a in alerts] == ["critical"]
    assert alerts[0].message == "Job Safety Analysis (JSA) for Store 118 expired 10/12/2026. Complete it again on arrival."


def test_certification_expiring_within_14_days_is_info_and_expired_ones_are_ignored():
    certs = [
        Cert("T1", "Lockout/Tagout Authorized", "VALID", date(2026, 11, 2)),
        Cert("T1", "EPA 608 Universal", "VALID", date(2028, 3, 15)),
        Cert("T1", "Confined Space Entry", "EXPIRED", date(2026, 9, 30)),
    ]
    alerts = alert_rules.expiring_certs(certs, TODAY)
    assert [a.message for a in alerts] == ["Your Lockout/Tagout Authorized certification expires 11/02/2026."]
    assert alerts[0].severity == "info"


def test_rank_orders_by_severity_and_numbers_ids():
    mk = lambda sev: Alert(id="tmp", severity=sev, message=sev)  # noqa: E731
    ranked = alert_rules.rank([mk("info"), mk("critical"), mk("warning"), mk("warning")])
    assert [(a.id, a.severity) for a in ranked] == [("a1", "critical"), ("a2", "warning"), ("a3", "warning"), ("a4", "info")]
