"""Sampro raw rows -> normalized view models. Pure functions, no I/O."""
from context_api.models import Record
from context_api.normalize import parse_yyyymmdd, sentence_case

STATUS = {
    "CMP": "completed",
    "OPN": "open",
    "INP": "in_progress",
    "HLD": "on_hold",
    "CAN": "cancelled",
}


def history_records(rows: list[dict]) -> tuple[list[Record], int]:
    """Returns (records, dropped_count). Rows with an unparseable or missing date are dropped."""
    records, dropped = [], 0
    for row in rows:
        day = parse_yyyymmdd(row.get("svc_dt"))
        if day is None:
            dropped += 1
            continue
        records.append(
            Record(
                id=f"sampro-{row['svc_id']}",
                date=day.isoformat(),
                title=sentence_case(row.get("work_desc")) or "(no description)",
                status=STATUS.get(row.get("st_cd"), "unknown"),
                flags=["recurring issue"] if row.get("repeat_fail") == 1 else [],
                sources=["sampro"],
            )
        )
    return records, dropped


def stock_by_part(rows: list[dict]) -> dict[str, int]:
    """Van stock by part id. Negative quantities (a data error) are clamped to zero."""
    return {row["part_id"]: max(0, int(row["qty_on_hand"])) for row in rows}
