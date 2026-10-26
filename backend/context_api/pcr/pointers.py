"""History pointers: the PCR issues them, the aggregator redeems them.

A pointer is only valid for the session that received it, so one worker cannot read another
worker's history by guessing a pointer. In-memory for now; Redis later (see the System Design Doc).
"""
from dataclasses import dataclass


@dataclass(frozen=True)
class HistoryTarget:
    session_id: str
    equipment_id: str


class PointerStore:
    def __init__(self) -> None:
        self._targets: dict[str, HistoryTarget] = {}
        self._seq: dict[str, int] = {}

    def issue(self, session_id: str, equipment_id: str) -> str:
        pointer = f"hist_{session_id}_{equipment_id}"
        self._targets[pointer] = HistoryTarget(session_id, equipment_id)
        return pointer

    def resolve(self, session_id: str, pointer: str):
        target = self._targets.get(pointer)
        return target if target and target.session_id == session_id else None

    def next_seq(self, session_id: str) -> int:
        self._seq[session_id] = self._seq.get(session_id, 0) + 1
        return self._seq[session_id]
