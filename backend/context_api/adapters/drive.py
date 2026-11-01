"""Shared-drive spreadsheet rows -> Records for one piece of equipment. Pure functions."""
from context_api.models import Record
from context_api.normalize import normalize_equipment_id, parse_us_date


def history_records(rows: list[dict], equipment_id: str) -> tuple[list[Record], int]:
    """Returns (records, dropped_count). The equipment column is typed inconsistently, so match on
    the normalized id. Rows with no usable date are dropped."""
    wanted = normalize_equipment_id(equipment_id)
    records, dropped = [], 0
    for index, row in enumerate(rows):
        if normalize_equipment_id(row.get("Equipment")) != wanted:
            continue
        day = parse_us_date(row.get("Date"))
        if day is None:
            dropped += 1
            continue
        records.append(
            Record(
                id=f"drive-{index}",
                date=day.isoformat(),
                title=(row.get("Notes") or "").strip() or "(no description)",
                status="unknown",
                flags=[],
                sources=["shared_drive"],
            )
        )
    return records, dropped
