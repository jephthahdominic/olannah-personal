"""The endpoints the canvas calls.

`create_router` holds the routes so they can be mounted on the existing backend app (main.py).
`create_app` wraps the router in its own FastAPI app with CORS; tests and the contract export use it.
"""
import asyncio
import logging
import time
from typing import Literal, Optional

from fastapi import APIRouter, Depends, FastAPI, Header, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from context_api.config import FAULT_MODES, KNOWN_SYSTEMS, Settings
from context_api.models import ContextObject, DegradedField, HistoryMessage
from context_api.pcr.pointers import PointerStore
from context_api.pcr.resolver import Resolver
from context_api.sca.history import HistoryService
from context_api.sources.base import Sources
from context_api.sources.mock import MockSources


log = logging.getLogger("olannah.delivery")

PayloadFault = Literal["bad_schema", "malformed_zone", "malformed_envelope"]
NOT_A_LIST = "not-a-list"


class DeliveryControls(BaseModel):
    """Dev-only: make the mock misbehave the way the BRD says the canvas must survive."""

    delay_seconds: float = Field(default=0.0, ge=0)  # slow the whole context delivery
    payload: Optional[PayloadFault] = None  # corrupt what is delivered


def corrupt_context(context: ContextObject, fault: PayloadFault) -> dict:
    body = context.model_dump(mode="json")
    if fault == "bad_schema":
        body["schema_version"] = "9.9"  # unrecognised version -> canvas fallback state (BRD SR 20)
    elif fault == "malformed_zone":
        body["zones"]["alerts"]["data"] = NOT_A_LIST  # one zone is unreadable -> that zone only (SR 21A)
    else:
        body["zones"] = "garbage"  # the envelope itself is unreadable -> workspace fallback (SR 21B)
    return body


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
    dev = DeliveryControls()  # mutable, only reachable through the dev endpoints

    @router.get("/healthz")
    async def healthz() -> dict:
        return {"status": "ok"}

    @router.get(
        "/v1/sessions/{session_id}/context",
        response_model=ContextObject,
        responses={
            401: {"description": "Session not confirmed"},
            404: {"description": "Session or role cannot be determined"},
            504: {"description": "Context was not delivered before the hard timeout (10s): show the recovery screen"},
        },
    )
    async def get_context(response: Response, session: Session = Depends(get_session)) -> ContextObject:
        async def deliver() -> Optional[ContextObject]:
            if dev.delay_seconds:
                await asyncio.sleep(dev.delay_seconds)
            return await resolver.resolve(session.session_id)

        started = time.monotonic()
        try:
            context = await asyncio.wait_for(deliver(), settings.hard_timeout)
        except asyncio.TimeoutError:
            log.error("context delivery hard timeout session=%s after=%.1fs", session.session_id, settings.hard_timeout)
            raise HTTPException(status_code=504, detail="Context delivery timed out")
        if context is None:
            raise HTTPException(status_code=404, detail="Role could not be determined")
        elapsed = time.monotonic() - started
        if elapsed > settings.pcr_budget:
            # BRD UR 10B: over budget is a degraded delivery, not a failure. Still delivered, and recorded.
            log.warning("degraded context delivery session=%s elapsed=%.3fs budget=%.1fs", session.session_id, elapsed, settings.pcr_budget)
            context.degraded_fields.append(DegradedField(field="delivery", reason="budget_exceeded"))
        response.headers["Cache-Control"] = "no-store"  # worker-specific data
        if dev.payload:
            return JSONResponse(corrupt_context(context, dev.payload), headers={"Cache-Control": "no-store"})
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
        if dev.payload == "malformed_zone":
            body = message.model_dump(mode="json")
            body["data"] = NOT_A_LIST
            return JSONResponse(body, headers={"Cache-Control": "no-store"})
        return message

    if settings.dev_endpoints:

        @router.get("/v1/dev/delivery")
        async def get_delivery() -> DeliveryControls:
            return dev

        @router.post("/v1/dev/delivery")
        async def set_delivery(controls: DeliveryControls) -> DeliveryControls:
            dev.delay_seconds, dev.payload = controls.delay_seconds, controls.payload
            return dev

        @router.delete("/v1/dev/delivery")
        async def clear_delivery() -> DeliveryControls:
            dev.delay_seconds, dev.payload = 0.0, None
            return dev

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
