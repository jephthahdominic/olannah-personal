from fastapi import FastAPI
from context_api.api import add_cors, create_router
from context_api.config import Settings
from db import get_connection

app = FastAPI()

_context_settings = Settings.from_env()
add_cors(app, _context_settings)
app.include_router(create_router(_context_settings))


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/db-health")
def db_health():
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT 1")
            cur.fetchone()
    return {"database": "ok"}
