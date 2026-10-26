"""Stand-in for Identity and Access plus the 'worker marked on site' event.

Real version: SSO session -> user and role; the active work order comes from the on-site event.
"""
from dataclasses import dataclass
from typing import Optional


@dataclass(frozen=True)
class ResolvedIdentity:
    worker_id: str
    role: str
    wo_no: Optional[int]  # the active work order, if any


_SESSIONS = {
    "s_8f2": ResolvedIdentity("T0042", "technician", 4471),
    # a role that exists but has no layout in the registry (exercises the unmapped-role path)
    "s_unmapped": ResolvedIdentity("T0042", "dispatcher", 4471),
}


def identify(session_id: str) -> Optional[ResolvedIdentity]:
    return _SESSIONS.get(session_id)
