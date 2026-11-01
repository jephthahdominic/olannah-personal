from fastapi.testclient import TestClient

from main import app

AUTH = {"Authorization": "Bearer dev", "X-Tenant-Id": "t_acme_hvac"}
client = TestClient(app)


def test_context_api_is_mounted_on_the_backend_app():
    response = client.get("/v1/sessions/s_8f2/context", headers=AUTH)
    assert response.status_code == 200
    assert response.json()["active_work_order"]["id"] == "WO-4471"


def test_existing_backend_routes_still_work():
    assert client.get("/health").json() == {"status": "ok"}


def test_cors_allows_the_frontend_origin():
    response = client.options(
        "/v1/sessions/s_8f2/context",
        headers={"Origin": "http://localhost:3000", "Access-Control-Request-Method": "GET"},
    )
    assert response.headers["access-control-allow-origin"] == "http://localhost:3000"
