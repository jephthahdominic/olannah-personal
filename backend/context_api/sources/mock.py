"""Mock source systems that read the fixtures in sample-data/. Supports fault injection."""
import asyncio
import csv
import json
from pathlib import Path
from typing import Any, Optional

from context_api.sources.base import SourceUnavailable

LOGIN_PAGE = "<html>Please sign in to continue</html>"


class MockSources:
    def __init__(self, fixture_dir: Path, faults: Optional[dict] = None):
        self.faults: dict = dict(faults or {})  # system -> "down" | "slow" | "login_wall"
        read = lambda name: json.loads((fixture_dir / name).read_text())  # noqa: E731
        self._sampro = read("sampro-mock.json")
        self._xtreme = read("xtreme.json")
        self._xoi = read("xoi.json")
        self._sitedocs = read("sitedocs.json")
        self._portal = read("client-portal.json")
        with (fixture_dir / "shared-drive-history.csv").open(newline="") as handle:
            self._drive = list(csv.DictReader(handle))

    async def _guard(self, system: str) -> None:
        mode = self.faults.get(system)
        if mode == "down":
            raise SourceUnavailable(system)
        if mode == "slow":
            await asyncio.sleep(5)

    @staticmethod
    def _find(rows: list[dict], key: str, value: Any) -> Optional[dict]:
        return next((r for r in rows if r.get(key) == value), None)

    # ----- Sampro -----
    async def work_order(self, wo_no):
        await self._guard("sampro")
        return self._find(self._sampro["work_orders"], "wo_no", wo_no)

    async def tech(self, tech_id):
        await self._guard("sampro")
        return self._find(self._sampro["techs"], "tech_id", tech_id)

    async def customer(self, cust_id):
        await self._guard("sampro")
        return self._find(self._sampro["customers"], "cust_id", cust_id)

    async def site(self, site_id):
        await self._guard("sampro")
        return self._find(self._sampro["sites"], "site_id", site_id)

    async def equipment(self, eq_id):
        await self._guard("sampro")
        return self._find(self._sampro["equipment"], "eq_id", eq_id)

    async def service_history(self, eq_id):
        await self._guard("sampro")
        return [r for r in self._sampro["service_history"] if r.get("eq_id") == eq_id]

    async def van_inventory(self, van_id):
        await self._guard("sampro")
        return [r for r in self._sampro["van_inventory"] if r.get("van_id") == van_id]

    async def parts(self):
        await self._guard("sampro")
        return list(self._sampro["parts"])

    async def part_usage(self, part_id):
        await self._guard("sampro")
        return [r for r in self._sampro["service_history"] if part_id in r.get("parts_used", [])]

    # ----- Xtreme -----
    async def xtreme_work_order(self, external_ref):
        await self._guard("xtreme")
        return self._find(self._xtreme["workOrders"], "externalRef", external_ref)

    # ----- XOi -----
    async def xoi_workflows(self):
        await self._guard("xoi")
        return list(self._xoi["workflows"])

    async def xoi_progress(self, wo_no):
        """Workflow step numbers already completed on this job (empty when XOi has no record)."""
        await self._guard("xoi")
        row = self._find(self._xoi.get("progress", []), "wo_no", wo_no)
        return list(row["completed_seqs"]) if row else []

    # ----- SiteDocs -----
    async def sitedocs_required(self):
        await self._guard("sitedocs")
        return list(self._sitedocs["required_documents"])

    async def sitedocs_certs(self, worker_id):
        await self._guard("sitedocs")
        return [c for c in self._sitedocs["worker_certifications"] if c.get("workerId") == worker_id]

    # ----- Shared drive -----
    async def drive_history(self):
        await self._guard("shared_drive")
        return list(self._drive)

    # ----- Client portal -----
    async def portal_ticket(self, po):
        await self._guard("client_portal")
        if self.faults.get("client_portal") == "login_wall":
            return LOGIN_PAGE  # HTTP 200 with HTML instead of data
        return self._find(self._portal["tickets"], "po", po)
