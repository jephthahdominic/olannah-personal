from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_health_returns_ok():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


from unittest.mock import MagicMock
import main


def test_db_health_returns_ok(monkeypatch):
    mock_cursor = MagicMock()
    mock_cursor.__enter__.return_value = mock_cursor
    mock_conn = MagicMock()
    mock_conn.__enter__.return_value = mock_conn
    mock_conn.cursor.return_value = mock_cursor

    monkeypatch.setattr(main, "get_connection", lambda: mock_conn)

    response = client.get("/db-health")

    assert response.status_code == 200
    assert response.json() == {"database": "ok"}
