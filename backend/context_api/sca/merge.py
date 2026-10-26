"""Merge two history sources for ONE piece of equipment into a single de-duplicated timeline."""
from context_api.models import Record


def merge(sampro: list[Record], drive: list[Record]) -> tuple[list[Record], int]:
    """Sampro is the system of record, so its record wins when both systems logged the same day.
    A shared-drive record on a day Sampro already has is absorbed (and the source is noted); a second
    shared-drive record on the same day is a duplicate. Returns (newest-first records, absorbed_count)."""
    merged = list(sampro)
    by_date = {r.date: i for i, r in reversed(list(enumerate(merged)))}  # first sampro record per day
    absorbed = 0
    for rec in drive:
        index = by_date.get(rec.date)
        if index is None:
            merged.append(rec)
            by_date[rec.date] = len(merged) - 1
            continue
        absorbed += 1
        existing = merged[index]
        if "shared_drive" not in existing.sources:
            merged[index] = existing.model_copy(update={"sources": existing.sources + ["shared_drive"]})
    merged.sort(key=lambda r: r.date, reverse=True)
    return merged, absorbed
