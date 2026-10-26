"""Regenerates the frontend handoff files:  python -m context_api.export_contract

  handoff/openapi.json           machine-readable contract (generate TypeScript types from this)
  handoff/examples/*.json         real responses for the happy path and each degraded state
"""
import json
from pathlib import Path

from fastapi.testclient import TestClient

from context_api.config import Settings
from context_api.api import create_app

ROOT = Path(__file__).resolve().parent.parent  # backend/
DOCS = ROOT / "context_api" / "handoff"
AUTH = {"Authorization": "Bearer dev", "X-Tenant-Id": "t_acme_hvac"}

# (file name, session id, faults injected into the mock systems)
CONTEXT_SCENARIOS = [
    ("context.happy.json", "s_8f2", {}),
    ("context.sitedocs-down.json", "s_8f2", {"sitedocs": "down"}),
    ("context.sitedocs-and-xoi-down.json", "s_8f2", {"sitedocs": "down", "xoi": "down"}),
    ("context.portal-login-wall.json", "s_8f2", {"client_portal": "login_wall"}),
    ("context.sampro-down.json", "s_8f2", {"sampro": "down"}),
    ("context.unmapped-role.json", "s_unmapped", {}),
    ("context.clear.json", "s_clear", {}),
    ("context.busy.json", "s_busy", {}),
    ("context.busy-xoi-down.json", "s_busy", {"xoi": "down"}),
    ("context.no-active-job.json", "s_nojob", {}),
]


def write(path: Path, payload) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2) + "\n")
    print("wrote", path.relative_to(ROOT))


def client(faults: dict) -> TestClient:
    settings = Settings(fixture_dir=ROOT / "sample-data", faults=faults, source_timeout=0.3)
    return TestClient(create_app(settings))


def main() -> None:
    write(DOCS / "openapi.json", client({}).get("/openapi.json").json())
    for name, session_id, faults in CONTEXT_SCENARIOS:
        response = client(faults).get(f"/v1/sessions/{session_id}/context", headers=AUTH)
        response.raise_for_status()
        write(DOCS / "examples" / name, response.json())
    happy = client({})
    pointer = happy.get("/v1/sessions/s_8f2/context", headers=AUTH).json()["zones"]["history"]["pointer"]
    write(DOCS / "examples" / "history.happy.json", happy.get(f"/v1/sessions/s_8f2/history/{pointer}", headers=AUTH).json())
    for name, session_id in (("history.clear.json", "s_clear"), ("history.busy.json", "s_busy")):
        c = client({})
        pointer = c.get(f"/v1/sessions/{session_id}/context", headers=AUTH).json()["zones"]["history"]["pointer"]
        write(DOCS / "examples" / name, c.get(f"/v1/sessions/{session_id}/history/{pointer}", headers=AUTH).json())
    down = client({"shared_drive": "down"})
    pointer = down.get("/v1/sessions/s_8f2/context", headers=AUTH).json()["zones"]["history"]["pointer"]
    write(DOCS / "examples" / "history.drive-down.json", down.get(f"/v1/sessions/s_8f2/history/{pointer}", headers=AUTH).json())


if __name__ == "__main__":
    main()
