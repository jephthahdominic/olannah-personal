import pytest
from pydantic import ValidationError

from context_api.models import Alert, ContextObject


def minimal_context() -> dict:
    zone = {"state": "ready", "as_of": "2026-10-23T08:00:03-05:00"}
    return {
        "schema_version": "1.0",
        "session_id": "s_1",
        "delivered_at": "2026-10-23T08:00:03-05:00",
        "worker": {"id": "T1", "name": "A", "role_label": "Field Technician"},
        "layout": {"template_id": "technician.v1", "destinations": []},
        "active_work_order": None,
        "connection_status": [],
        "zones": {
            "alerts": {**zone, "data": []},
            "work_order": {**zone, "data": None},
            "steps": {**zone, "data": []},
            "actions": {**zone, "data": []},
            "history": {"state": "loading", "pointer": "hist_x"},
        },
        "degraded_fields": [],
    }


def test_minimal_context_validates():
    ctx = ContextObject.model_validate(minimal_context())
    assert ctx.active_work_order is None
    assert ctx.zones.history.pointer == "hist_x"


def test_rejects_unknown_zone_state():
    bad = minimal_context()
    bad["zones"]["alerts"]["state"] = "weird"
    with pytest.raises(ValidationError):
        ContextObject.model_validate(bad)


def test_rejects_unknown_alert_severity():
    with pytest.raises(ValidationError):
        Alert(id="a1", severity="catastrophic", message="x")
