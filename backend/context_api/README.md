# Olannah context API

The backend a canvas calls to get a worker's workspace. It contains a working **Persona Context
Resolver (PCR)** and the history part of the **Streaming Canvas Aggregator (SCA)**. The six source
systems (Sampro, Xtreme, XOi, SiteDocs, a shared drive, a client portal) are **mocked** from files in
`backend/sample-data/`. Everything above the mock layer is real logic.

## Run it

It is part of the existing backend: `backend/main.py` mounts the router, so it is served on the same port as `/health`.

```bash
cp .env.example .env
docker compose up -d --build   # backend on http://localhost:8000, interactive docs at /docs (dev fault endpoints on by default)
```

Without Docker:

```bash
cd backend
python3 -m venv .venv && .venv/bin/python -m pip install -r requirements.txt
OLANNAH_DEV=1 .venv/bin/python -m uvicorn main:app --reload --port 8000
```

```bash
curl -s -H "Authorization: Bearer dev" -H "X-Tenant-Id: t_acme_hvac" \
  http://localhost:8000/v1/sessions/s_8f2/context
```

## Test it

```bash
cd backend
.venv/bin/python -m pytest -q --cov=context_api --cov-fail-under=80
```

## For the frontend developer

Read [handoff/FRONTEND.md](handoff/FRONTEND.md). Contract: [handoff/openapi.json](handoff/openapi.json). Real
responses for every degraded state: [handoff/examples/](handoff/examples/). Regenerate both after any
contract change: `cd backend && .venv/bin/python -m context_api.export_contract`.

## Layers (only the bottom one is mocked)

```
endpoints (context_api/api.py)
  -> PCR (context_api/pcr)  and  SCA (context_api/sca)      correlate, run alert rules, assemble zones, merge history
    -> adapters (context_api/adapters)              raw system data -> normalized view models (pure functions)
      -> sources (context_api/sources)              MOCK today (reads sample-data/); real HTTP/MCP clients later
```

To go live, implement the `Sources` protocol in `context_api/sources/base.py` with real clients, and pass it
to `create_router(sources=...)` (see `main.py`). Nothing above that layer changes.

## Configuration (environment variables)

| Variable | Meaning | Default |
|---|---|---|
| `OLANNAH_DEV` | `1` enables `/v1/dev/faults` and `/v1/dev/delivery` (slow or corrupt the delivery) | off |
| `OLANNAH_FAULTS` | start with faults, e.g. `sitedocs=down,xtreme=slow` | none |
| `OLANNAH_NOW` | ISO timestamp the app treats as "now", or `real` | `2026-10-23T08:00:03-05:00` |
| `OLANNAH_CORS_ORIGINS` | comma-separated allowed origins | `http://localhost:3000` |
| `OLANNAH_FIXTURE_DIR` | folder with the mock data | `backend/sample-data` |

The default clock is frozen because the sample data is dated around 2026-10-23.

## Sessions available in the mock

| Session id | What it is |
|---|---|
| `s_8f2` | Marcus, field technician, work order WO-4471 (the main scenario) |
| `s_unmapped` | A role with no layout, to exercise the platform-default path |
| `s_clear` | Priya, WO-4502. Everything is fine, so `alerts`, `steps` and `history` are empty lists (empty states) and `closeJob` is enabled |
| `s_busy` | Dana, WO-4510. 10 alerts of every severity and suggestion shape, 19 steps (`done`, `current`, `todo`, all four kinds), long text, a 28-record history |
| `s_nojob` | Owen, logged in with no active work order. `active_work_order` is null, every zone is `rendered` and empty, and `zones.history.pointer` is null |
| anything else | 404 |
