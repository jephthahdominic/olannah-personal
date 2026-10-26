"""Xtreme raw work order -> the few fields Olannah needs. Pure functions."""
from dataclasses import dataclass
from datetime import datetime
from typing import Optional

from context_api.normalize import parse_iso_datetime


@dataclass(frozen=True)
class XtremeJob:
    customer_name: Optional[str]
    site_name: Optional[str]
    scheduled_start: Optional[datetime]
    last_synced: Optional[datetime]


def parse_job(raw: dict) -> XtremeJob:
    return XtremeJob(
        customer_name=(raw.get("customer") or {}).get("name"),
        site_name=(raw.get("site") or {}).get("name"),
        scheduled_start=parse_iso_datetime(raw.get("scheduledStart")),
        last_synced=parse_iso_datetime(raw.get("lastSyncedAt")),
    )
