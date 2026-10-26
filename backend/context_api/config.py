from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path

DEFAULT_NOW = "2026-10-23T08:00:03-05:00"  # the sample data is dated around this moment
KNOWN_SYSTEMS = ("sampro", "xtreme", "xoi", "sitedocs", "shared_drive", "client_portal")
FAULT_MODES = ("down", "slow", "login_wall")

# Which source systems accept writes today. All false, so every action is a manual step.
SYSTEM_WRITE_BACK = {
    "sampro": False,
    "xtreme": False,
    "xoi": False,
    "sitedocs": False,
    "client_portal": False,
}


def _parse_faults(raw: str) -> dict:
    faults = {}
    for part in (p.strip() for p in raw.split(",")):
        if part:
            name, _, mode = part.partition("=")
            faults[name.strip()] = mode.strip()
    return faults


@dataclass(frozen=True)
class Settings:
    fixture_dir: Path = Path(__file__).resolve().parent.parent / "sample-data"
    faults: dict = field(default_factory=dict)  # e.g. {"sitedocs": "down"}
    now: str = DEFAULT_NOW  # ISO timestamp, or "real" for the wall clock
    source_timeout: float = 0.3  # seconds per source call
    pcr_budget: float = 0.8  # BRD: PCR delivery budget
    stale_after_hours: float = 12.0  # work-order data older than this is shown as stale
    cors_origins: tuple = ("http://localhost:3000",)
    dev_endpoints: bool = False  # enables /v1/dev/faults

    def clock(self) -> datetime:
        if self.now == "real":
            return datetime.now().astimezone()
        return datetime.fromisoformat(self.now)

    @classmethod
    def from_env(cls) -> "Settings":
        import os

        env = os.environ.get
        kwargs = {}
        if env("OLANNAH_FIXTURE_DIR"):
            kwargs["fixture_dir"] = Path(env("OLANNAH_FIXTURE_DIR"))
        if env("OLANNAH_FAULTS"):
            kwargs["faults"] = _parse_faults(env("OLANNAH_FAULTS"))
        if env("OLANNAH_NOW"):
            kwargs["now"] = env("OLANNAH_NOW")
        if env("OLANNAH_CORS_ORIGINS"):
            kwargs["cors_origins"] = tuple(o.strip() for o in env("OLANNAH_CORS_ORIGINS").split(",") if o.strip())
        kwargs["dev_endpoints"] = env("OLANNAH_DEV") == "1"
        return cls(**kwargs)
