"""The contract between the backend and the canvas. Plain data only (no classes with behaviour)."""
from typing import Literal, Optional

from pydantic import BaseModel, Field

ZoneState = Literal["loading", "ready", "stale", "unavailable"]


# ---------- view models ----------
class Evidence(BaseModel):
    system: str
    ref: str


class Alert(BaseModel):
    id: str
    severity: Literal["info", "warning", "critical"]
    message: str
    suggestion: Optional[str] = None
    evidence: list[Evidence] = Field(default_factory=list)


class EntityField(BaseModel):
    label: str
    value: str


class Entity(BaseModel):
    id: str
    title: str
    fields: list[EntityField]


class Step(BaseModel):
    id: str
    kind: Literal["confirm", "photo", "question", "guide"]
    label: str
    status: Literal["todo", "current", "done"]
    required: bool = True
    source: Optional[str] = None


class Action(BaseModel):
    name: str
    label: str
    enabled: bool
    write_back: Literal["auto", "manual", "none"]
    needs_checkpoint: bool


class Record(BaseModel):
    id: str
    date: str  # ISO date, YYYY-MM-DD
    title: str
    status: str
    flags: list[str] = Field(default_factory=list)
    sources: list[str] = Field(default_factory=list)


# ---------- zones ----------
class AlertsZone(BaseModel):
    state: ZoneState
    as_of: Optional[str] = None
    data: list[Alert] = Field(default_factory=list)


class WorkOrderZone(BaseModel):
    state: ZoneState
    as_of: Optional[str] = None
    data: Optional[Entity] = None


class StepsZone(BaseModel):
    state: ZoneState
    as_of: Optional[str] = None
    data: list[Step] = Field(default_factory=list)


class ActionsZone(BaseModel):
    state: ZoneState
    as_of: Optional[str] = None
    data: list[Action] = Field(default_factory=list)


class HistoryZone(BaseModel):
    state: ZoneState
    pointer: Optional[str] = None  # the canvas never resolves this; GET /history/{pointer} does


class Zones(BaseModel):
    alerts: AlertsZone
    work_order: WorkOrderZone
    steps: StepsZone
    actions: ActionsZone
    history: HistoryZone


# ---------- context object ----------
class Worker(BaseModel):
    id: str
    name: str
    role_label: str


class Layout(BaseModel):
    template_id: str
    destinations: list[str]


class ActiveWorkOrder(BaseModel):
    id: str
    site_name: str
    task_summary: Optional[str] = None


class SystemStatus(BaseModel):
    system: str
    state: Literal["live", "read_only", "down"]
    write_back: bool
    last_synced: Optional[str] = None


class DegradedField(BaseModel):
    field: str
    reason: str


class ContextObject(BaseModel):
    schema_version: str
    session_id: str
    delivered_at: str
    worker: Worker
    layout: Layout
    active_work_order: Optional[ActiveWorkOrder] = None
    connection_status: list[SystemStatus]
    zones: Zones
    degraded_fields: list[DegradedField] = Field(default_factory=list)


# ---------- history message (Streaming Canvas Aggregator) ----------
class DataQuality(BaseModel):
    deduplicated: int = 0
    dropped_undated: int = 0
    unavailable_sources: list[str] = Field(default_factory=list)


class HistoryMessage(BaseModel):
    type: Literal["zone_data"] = "zone_data"
    session_id: str
    zone_id: Literal["history"] = "history"
    seq: int
    state: ZoneState
    as_of: str
    data: list[Record] = Field(default_factory=list)
    data_quality: DataQuality = Field(default_factory=DataQuality)
