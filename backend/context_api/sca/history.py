"""Streaming Canvas Aggregator (history part): redeems a pointer and delivers history in a later pass."""
import asyncio
from typing import Optional

from context_api.adapters import drive as drive_adapter
from context_api.adapters import sampro as sampro_adapter
from context_api.config import Settings
from context_api.models import DataQuality, HistoryMessage
from context_api.pcr.pointers import PointerStore
from context_api.pcr.safe import call
from context_api.sca.merge import merge
from context_api.sources.base import Sources


class HistoryService:
    def __init__(self, sources: Sources, settings: Settings, pointers: PointerStore):
        self.sources = sources
        self.settings = settings
        self.pointers = pointers

    async def fetch(self, session_id: str, pointer: str) -> Optional[HistoryMessage]:
        target = self.pointers.resolve(session_id, pointer)
        if target is None:
            return None  # unknown pointer, or it belongs to another session
        now = self.settings.clock()
        timeout = self.settings.source_timeout
        sampro_out, drive_out = await asyncio.gather(
            call(self.sources.service_history(target.equipment_id), timeout),
            call(self.sources.drive_history(), timeout),
        )
        unavailable = [name for name, o in (("sampro", sampro_out), ("shared_drive", drive_out)) if not o.ok]
        seq = self.pointers.next_seq(session_id)
        if len(unavailable) == 2:
            return HistoryMessage(
                session_id=session_id,
                seq=seq,
                state="unavailable",
                as_of=now.isoformat(),
                data_quality=DataQuality(unavailable_sources=unavailable),
            )
        sampro_records, sampro_dropped = sampro_adapter.history_records(sampro_out.value) if sampro_out.ok else ([], 0)
        drive_records, drive_dropped = (
            drive_adapter.history_records(drive_out.value, target.equipment_id) if drive_out.ok else ([], 0)
        )
        records, absorbed = merge(sampro_records, drive_records)
        return HistoryMessage(
            session_id=session_id,
            seq=seq,
            state="rendered",
            as_of=now.isoformat(),
            data=records,
            data_quality=DataQuality(
                deduplicated=absorbed,
                dropped_undated=sampro_dropped + drive_dropped,
                unavailable_sources=unavailable,
            ),
        )
