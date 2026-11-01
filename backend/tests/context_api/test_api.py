import pytest
from fastapi.testclient import TestClient

from context_api.config import Settings
from context_api.api import create_app
from tests.context_api.conftest import FIXTURES

AUTH = {"Authorization": "Bearer dev", "X-Tenant-Id": "t_acme_hvac"}


def client(**overrides) -> TestClient:
    return TestClient(create_app(Settings(fixture_dir=FIXTURES, **overrides)))


def test_healthz():
    assert client().get("/healthz").json() == {"status": "ok"}


def test_context_happy_path_and_headers():
    r = client().get("/v1/sessions/s_8f2/context", headers=AUTH)
    assert r.status_code == 200
    assert r.headers["cache-control"] == "no-store"
    body = r.json()
    assert body["layout_config"]["template_id"] == "technician.v1"
    assert set(body["zones"]) == {"alerts", "work_order", "steps", "actions", "history"}
    assert body["active_work_order"]["id"] == "WO-4471"


@pytest.mark.parametrize("headers", [{}, {"Authorization": "Bearer dev"}, {"X-Tenant-Id": "t"}, {"Authorization": "Basic x", "X-Tenant-Id": "t"}])
def test_missing_or_bad_auth_is_401(headers):
    assert client().get("/v1/sessions/s_8f2/context", headers=headers).status_code == 401


def test_unknown_session_is_404():
    assert client().get("/v1/sessions/s_nope/context", headers=AUTH).status_code == 404


def test_history_round_trip_uses_the_pointer_from_context():
    c = client()
    pointer = c.get("/v1/sessions/s_8f2/context", headers=AUTH).json()["zones"]["history"]["pointer"]
    r = c.get(f"/v1/sessions/s_8f2/history/{pointer}", headers=AUTH)
    assert r.status_code == 200
    assert r.json()["zone_id"] == "history" and len(r.json()["data"]) == 5


def test_history_requires_auth_and_rejects_unknown_pointers():
    c = client()
    c.get("/v1/sessions/s_8f2/context", headers=AUTH)
    assert c.get("/v1/sessions/s_8f2/history/hist_s_8f2_E-2231").status_code == 401
    assert c.get("/v1/sessions/s_8f2/history/nope", headers=AUTH).status_code == 404


def test_a_slow_source_degrades_its_zones_and_does_not_fail_the_delivery():
    c = client(faults={"sampro": "slow"})
    r = c.get("/v1/sessions/s_8f2/context", headers=AUTH)
    assert r.status_code == 200
    assert r.json()["zones"]["work_order"]["state"] == "unavailable"


def test_delivery_over_budget_still_arrives_and_is_flagged():
    c = client(dev_endpoints=True, pcr_budget=0.05, hard_timeout=2.0)
    assert c.post("/v1/dev/delivery", json={"delay_seconds": 0.2}).status_code == 200
    r = c.get("/v1/sessions/s_8f2/context", headers=AUTH)
    assert r.status_code == 200
    assert {"field": "delivery", "reason": "budget_exceeded"} in r.json()["degraded_fields"]


def test_delivery_past_the_hard_timeout_is_a_504():
    c = client(dev_endpoints=True, hard_timeout=0.1)
    c.post("/v1/dev/delivery", json={"delay_seconds": 1.0})
    assert c.get("/v1/sessions/s_8f2/context", headers=AUTH).status_code == 504


def test_delivery_within_budget_carries_no_delivery_flag():
    body = client().get("/v1/sessions/s_8f2/context", headers=AUTH).json()
    assert not any(d["field"] == "delivery" for d in body["degraded_fields"])


def test_context_carries_resolved_role_and_layout_config():
    body = client().get("/v1/sessions/s_8f2/context", headers=AUTH).json()
    assert body["resolved_role"] == "technician"
    assert "layout" not in body


def test_cors_preflight_allows_the_canvas_origin():
    r = client().options(
        "/v1/sessions/s_8f2/context",
        headers={"Origin": "http://localhost:3000", "Access-Control-Request-Method": "GET",
                 "Access-Control-Request-Headers": "authorization,x-tenant-id"},
    )
    assert r.status_code == 200
    assert r.headers["access-control-allow-origin"] == "http://localhost:3000"


def test_dev_fault_endpoints_are_off_by_default():
    assert client().get("/v1/dev/faults").status_code == 404


def test_dev_faults_can_be_toggled_at_runtime():
    c = client(dev_endpoints=True)
    assert c.post("/v1/dev/faults", json={"sitedocs": "down"}).json() == {"sitedocs": "down"}
    ctx = c.get("/v1/sessions/s_8f2/context", headers=AUTH).json()
    assert {s["system"]: s["state"] for s in ctx["connection_status"]}["sitedocs"] == "down"
    assert c.delete("/v1/dev/faults").json() == {}
    ctx = c.get("/v1/sessions/s_8f2/context", headers=AUTH).json()
    assert {s["system"]: s["state"] for s in ctx["connection_status"]}["sitedocs"] == "live"


def test_dev_faults_reject_unknown_systems_and_modes():
    c = client(dev_endpoints=True)
    assert c.post("/v1/dev/faults", json={"nonsense": "down"}).status_code == 422
    assert c.post("/v1/dev/faults", json={"sitedocs": "explode"}).status_code == 422


@pytest.mark.parametrize("session_id, work_order", [("s_clear", "WO-4502"), ("s_busy", "WO-4510"), ("s_nojob", None)])
def test_extra_mock_sessions_are_served(session_id, work_order):
    body = client().get(f"/v1/sessions/{session_id}/context", headers=AUTH).json()
    assert (body["active_work_order"] or {}).get("id") == work_order


def test_session_without_a_job_has_no_history_pointer():
    body = client().get("/v1/sessions/s_nojob/context", headers=AUTH).json()
    assert body["zones"]["history"] == {"state": "rendered", "pointer": None}


# ---------- dev controls: payload corruption for the canvas's error-handling tests ----------
def test_payload_fault_bad_schema_changes_only_the_version():
    c = client(dev_endpoints=True)
    c.post("/v1/dev/delivery", json={"payload": "bad_schema"})
    body = c.get("/v1/sessions/s_8f2/context", headers=AUTH).json()
    assert body["schema_version"] == "9.9"
    assert body["zones"]["alerts"]["state"] == "rendered"


def test_payload_fault_malformed_zone_breaks_one_zone_only():
    c = client(dev_endpoints=True)
    c.post("/v1/dev/delivery", json={"payload": "malformed_zone"})
    zones = c.get("/v1/sessions/s_8f2/context", headers=AUTH).json()["zones"]
    assert zones["alerts"]["data"] == "not-a-list"
    assert isinstance(zones["steps"]["data"], list)


def test_payload_fault_malformed_envelope_breaks_the_whole_context():
    c = client(dev_endpoints=True)
    c.post("/v1/dev/delivery", json={"payload": "malformed_envelope"})
    assert c.get("/v1/sessions/s_8f2/context", headers=AUTH).json()["zones"] == "garbage"


def test_payload_fault_malformed_zone_also_breaks_the_history_delivery():
    c = client(dev_endpoints=True)
    pointer = c.get("/v1/sessions/s_8f2/context", headers=AUTH).json()["zones"]["history"]["pointer"]
    c.post("/v1/dev/delivery", json={"payload": "malformed_zone"})
    assert c.get(f"/v1/sessions/s_8f2/history/{pointer}", headers=AUTH).json()["data"] == "not-a-list"


def test_delivery_controls_can_be_read_and_reset():
    c = client(dev_endpoints=True)
    assert c.get("/v1/dev/delivery").json() == {"delay_seconds": 0.0, "payload": None}
    c.post("/v1/dev/delivery", json={"delay_seconds": 0.5, "payload": "bad_schema"})
    assert c.get("/v1/dev/delivery").json() == {"delay_seconds": 0.5, "payload": "bad_schema"}
    assert c.delete("/v1/dev/delivery").json() == {"delay_seconds": 0.0, "payload": None}


def test_delivery_controls_reject_unknown_payload_faults_and_are_off_by_default():
    c = client(dev_endpoints=True)
    assert c.post("/v1/dev/delivery", json={"payload": "explode"}).status_code == 422
    assert client().get("/v1/dev/delivery").status_code == 404
