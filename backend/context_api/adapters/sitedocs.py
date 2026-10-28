"""SiteDocs raw rows -> typed documents and certifications. Pure functions."""
from dataclasses import dataclass
from datetime import date
from typing import Optional

from context_api.normalize import normalize_site, parse_us_date


@dataclass(frozen=True)
class SiteDoc:
    doc_id: str
    title: str
    status: str  # EXPIRED | REQUIRED | COMPLETED | anything else the system invents
    must_complete_by: Optional[str]  # ON_ARRIVAL | BEFORE_WORK | CLOSEOUT | None
    expires_on: Optional[date]


@dataclass(frozen=True)
class Cert:
    worker_id: str
    name: str
    status: str
    expires_on: Optional[date]


def required_documents(rows: list[dict], site_name: str) -> list[SiteDoc]:
    wanted = normalize_site(site_name)
    return [
        SiteDoc(
            doc_id=row["docId"],
            title=row["title"],
            status=(row.get("status") or "").upper(),
            must_complete_by=row.get("mustCompleteBy"),
            expires_on=parse_us_date(row.get("expiresOn")),
        )
        for row in rows
        if normalize_site(row.get("siteName")) == wanted
    ]


def certifications(rows: list[dict]) -> list[Cert]:
    return [
        Cert(
            worker_id=row["workerId"],
            name=row["cert"],
            status=(row.get("status") or "").upper(),
            expires_on=parse_us_date(row.get("expiresOn")),
        )
        for row in rows
    ]
