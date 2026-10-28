"""Run one source call with a timeout and turn any failure into data instead of an exception."""
import asyncio
import logging
from dataclasses import dataclass
from typing import Any, Awaitable, Optional

from context_api.sources.base import SourceUnavailable

log = logging.getLogger("olannah.pcr")


@dataclass(frozen=True)
class Outcome:
    ok: bool
    value: Any = None
    error: Optional[str] = None  # "unavailable" | "timeout" | "error"


async def call(awaitable: Awaitable[Any], timeout: float) -> Outcome:
    try:
        return Outcome(True, await asyncio.wait_for(awaitable, timeout))
    except SourceUnavailable:
        return Outcome(False, error="unavailable")
    except asyncio.TimeoutError:
        return Outcome(False, error="timeout")
    except Exception:  # a malformed record must degrade one zone, never the whole response
        log.exception("source call failed")
        return Outcome(False, error="error")
