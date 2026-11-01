"""Client portal raw ticket -> PortalTicket. Pure functions."""
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Optional

from context_api.normalize import parse_iso_datetime
from context_api.sources.base import SourceUnavailable


@dataclass(frozen=True)
class PortalTicket:
    ticket: str
    respond_by: Optional[datetime]
    resolve_by: Optional[datetime]


def parse_ticket(raw: Any) -> Optional[PortalTicket]:
    """None means 'no ticket for this PO' (a normal empty state). A str means the portal answered
    HTTP 200 with a login page instead of data, which is an outage, not an empty result."""
    if raw is None:
        return None
    if isinstance(raw, str):
        raise SourceUnavailable("client_portal")
    sla = raw.get("sla") or {}
    return PortalTicket(
        ticket=raw["ticket"],
        respond_by=parse_iso_datetime(sla.get("respond_by")),
        resolve_by=parse_iso_datetime(sla.get("resolve_by")),
    )
