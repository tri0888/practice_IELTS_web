"""Smoke test for app wiring — protects the M4 change from @app.on_event to
lifespan. Runs with no DB and no Telegram token, so startup returns early.
"""
from fastapi.testclient import TestClient

from app.main import app


def test_root_endpoint_reports_ok():
    with TestClient(app) as client:
        resp = client.get("/")
        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "ok"
        assert body["tests_endpoint"] == "/api/tests"


def test_protected_route_requires_auth():
    # /api/tests/... practice layout is behind require_approved -> 401 without token.
    with TestClient(app) as client:
        resp = client.get("/api/tests/11/1/practice")
        assert resp.status_code in (401, 403)
