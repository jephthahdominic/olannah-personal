"""The endpoints the canvas calls.

`create_router` holds the routes so they can be mounted on the existing backend app (main.py).
`create_app` wraps the router in its own FastAPI app with CORS; tests and the contract export use it.
"""
import asyncio
from typing import Literal, Optional

from fastapi import APIRouter, Depends, FastAPI, Header, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from context_api.config import FAULT_MODES, KNOWN_SYSTEMS, Settings
from context_api.models import ContextObject, HistoryMessage
from context_api.pcr.pointers import PointerStore
from context_api.pcr.resolver import Resolver
from context_api.sca.history import HistoryService
from context_api.sources.base import Sources
from context_api.sources.mock import MockSources


class Session(BaseModel):
    session_id: str
    tenant_id: str


async def get_session(
    session_id: str,
    authorization: Optional[str] = Header(default=None),
    x_tenant_id: Optional[str] = Header(default=None),
) -> Session:
    """Stand-in for real session validation, which Identity and Access owns.
    Accepts any 'Bearer <token>' plus an X-Tenant-Id header."""
    if not authorization or not authorization.startswith("Bearer ") or not x_tenant_id:
        raise HTTPException(status_code=401, detail="Session not confirmed")
    return Session(session_id=session_id, tenant_id=x_tenant_id)


def add_cors(app: FastAPI, settings: Settings) -> None:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(settings.cors_origins),
        allow_methods=["GET", "POST", "DELETE"],
        allow_headers=["Authorization", "X-Tenant-Id", "Content-Type"],
    )


def create_router(settings: Optional[Settings] = None, sources: Optional[Sources] = None) -> APIRouter:
    settings = settings or Settings.from_env()
    sources = sources or MockSources(settings.fixture_dir, dict(settings.faults))
    pointers = PointerStore()
    resolver = Resolver(sources, settings, pointers)
    history = HistoryService(sources, settings, pointers)

    router = APIRouter()

    @router.get("/healthz")
    async def healthz() -> dict:
        return {"status": "ok"}

    @router.get(
        "/v1/sessions/{session_id}/context",
        response_model=ContextObject,
        responses={
            401: {"description": "Session not confirmed"},
            404: {"description": "Session or role cannot be determined"},
            504: {"description": "Context delivery exceeded the 800ms budget"},
        },
    )
    async def get_context(response: Response, session: Session = Depends(get_session)) -> ContextObject:
        try:
            context = await asyncio.wait_for(resolver.resolve(session.session_id), settings.pcr_budget)
        except asyncio.TimeoutError:
            raise HTTPException(status_code=504, detail="Context delivery exceeded budget")
        if context is None:
            raise HTTPException(status_code=404, detail="Role could not be determined")
        response.headers["Cache-Control"] = "no-store"  # worker-specific data
        return context

    @router.get(
        "/v1/sessions/{session_id}/history/{pointer}",
        response_model=HistoryMessage,
        responses={401: {"description": "Session not confirmed"}, 404: {"description": "Unknown pointer"}},
    )
    async def get_history(pointer: str, response: Response, session: Session = Depends(get_session)) -> HistoryMessage:
        message = await history.fetch(session.session_id, pointer)
        if message is None:
            raise HTTPException(status_code=404, detail="Unknown history pointer")
        response.headers["Cache-Control"] = "no-store"
        return message

    if settings.dev_endpoints and hasattr(sources, "faults"):
        FaultMap = dict[str, Literal[FAULT_MODES]]  # type: ignore[valid-type]

        @router.get("/v1/dev/faults")
        async def list_faults() -> dict:
            return dict(sources.faults)

        @router.post("/v1/dev/faults")
        async def set_faults(faults: FaultMap) -> dict:
            unknown = [name for name in faults if name not in KNOWN_SYSTEMS]
            if unknown:
                raise HTTPException(status_code=422, detail=f"Unknown systems: {unknown}. Known: {list(KNOWN_SYSTEMS)}")
            sources.faults.update(faults)
            return dict(sources.faults)

        @router.delete("/v1/dev/faults")
        async def clear_faults() -> dict:
            sources.faults.clear()
            return {}

    return router


def create_app(settings: Optional[Settings] = None, sources: Optional[Sources] = None) -> FastAPI:
    settings = settings or Settings.from_env()
    app = FastAPI(title="Olannah context API", version="0.1.0")
    add_cors(app, settings)
    app.include_router(create_router(settings, sources))
    return app
