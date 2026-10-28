"""Rules that turn normalized data into Alerts. Pure functions: easy to test, and the seam where an
LLM-based ranker could later be added without touching anything else."""
from datetime import date, timedelta

from context_api.adapters.sitedocs import Cert, SiteDoc
from context_api.models import Alert, Evidence, Record
from context_api.normalize import parse_yyyymmdd, sentence_case

_SEVERITY_ORDER = {"critical": 0, "warning": 1, "info": 2}


def recurring_failure(history: list[Record], today: date) -> list[Alert]:
    """Two or more Sampro-flagged failures in the last 365 days."""
    recent = sorted(
        (
            r
            for r in history
            if "recurring issue" in r.flags
            and "sampro" in r.sources
            and timedelta(0) <= today - date.fromisoformat(r.date) <= timedelta(days=365)
        ),
        key=lambda r: r.date,
    )
    if len(recent) < 2:
        return []
    count = "twice" if len(recent) == 2 else f"{len(recent)} times"
    return [
        Alert(
            id="tmp",
            severity="warning",
            message=f"This equipment has failed {count} in the past 12 months.",
            evidence=[Evidence(system="sampro", ref=f"svc {r.id.removeprefix('sampro-')}") for r in recent],
        )
    ]


def missing_parts(
    required: list[str],
    stock: dict[str, int],
    catalog: dict[str, dict],
    usage: dict[str, list[dict]],
    van_id: str,
) -> list[Alert]:
    """A required part that is out of stock in the van, with a substitute if one is in stock.
    `usage` maps a substitute part id to the service rows where it was used."""
    alerts = []
    for part_id in required:
        if stock.get(part_id, 0) > 0:
            continue
        part = catalog.get(part_id, {})
        label = sentence_case(part.get("part_desc")) or "Part"
        evidence = [Evidence(system="sampro", ref=f"{van_id}/{part_id}")]
        suggestion = None
        alt = part.get("alt_part_id")
        if alt and stock.get(alt, 0) > 0:
            used = sorted(
                (r for r in usage.get(alt, []) if parse_yyyymmdd(r.get("svc_dt"))),
                key=lambda r: r["svc_dt"],
                reverse=True,
            )
            if used:
                when = parse_yyyymmdd(used[0]["svc_dt"]).isoformat()
                suggestion = (
                    f"{alt} ({stock[alt]} on hand) was used as a substitute on {when} "
                    f"(service {used[0]['svc_id']})."
                )
                evidence.append(Evidence(system="sampro", ref=f"svc {used[0]['svc_id']}"))
            else:
                suggestion = f"{alt} ({stock[alt]} on hand) is a listed substitute."
        alerts.append(
            Alert(
                id="tmp",
                severity="warning",
                message=f"{label} ({part_id}) is not in your van ({stock.get(part_id, 0)} on hand).",
                suggestion=suggestion,
                evidence=evidence,
            )
        )
    return alerts


def safety_documents(docs: list[SiteDoc], site_label: str) -> list[Alert]:
    """An expired safety document blocks work, so it is critical."""
    alerts = []
    for doc in docs:
        if doc.status != "EXPIRED":
            continue
        when = f" expired {doc.expires_on:%m/%d/%Y}" if doc.expires_on else " has expired"
        alerts.append(
            Alert(
                id="tmp",
                severity="critical",
                message=f"{doc.title} for {site_label}{when}. Complete it again on arrival.",
                evidence=[Evidence(system="sitedocs", ref=doc.doc_id)],
            )
        )
    return alerts


def expiring_certs(certs: list[Cert], today: date, window_days: int = 14) -> list[Alert]:
    """A still-valid certification that expires within `window_days`. Already-expired certs are
    ignored: we cannot know whether this job needs them."""
    alerts = []
    for cert in certs:
        if cert.status != "VALID" or cert.expires_on is None:
            continue
        if timedelta(0) <= cert.expires_on - today <= timedelta(days=window_days):
            alerts.append(
                Alert(
                    id="tmp",
                    severity="info",
                    message=f"Your {cert.name} certification expires {cert.expires_on:%m/%d/%Y}.",
                    evidence=[Evidence(system="sitedocs", ref=f"{cert.worker_id}/{cert.name}")],
                )
            )
    return alerts


def rank(alerts: list[Alert]) -> list[Alert]:
    """Most severe first (stable within a severity), then number the ids a1, a2, ..."""
    ordered = sorted(alerts, key=lambda a: _SEVERITY_ORDER[a.severity])
    return [a.model_copy(update={"id": f"a{i}"}) for i, a in enumerate(ordered, start=1)]
