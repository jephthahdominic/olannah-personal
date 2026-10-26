"""XOi client workflows -> the steps for one customer and equipment type. Pure functions."""
from dataclasses import dataclass

ALLOWED_KINDS = {"confirm", "photo", "question", "guide"}


@dataclass(frozen=True)
class XoiStep:
    kind: str
    label: str
    required: bool
    seq: int = 0


def pick_steps(workflows: list[dict], customer_name: str, equipment_type: str) -> list[XoiStep]:
    """XOi keys workflows by customer NAME (free text, case varies). Take the highest version that
    applies to the equipment type. Steps of an unknown kind, or without a title, are skipped."""
    wanted = customer_name.casefold()
    candidates = [
        w
        for w in workflows
        if w.get("customer_name", "").casefold() == wanted
        and equipment_type in w.get("applies_to_equipment_types", [])
    ]
    if not candidates:
        return []
    best = max(candidates, key=lambda w: w.get("version", 0))
    steps = sorted(best.get("steps", []), key=lambda s: s.get("seq", 0))
    return [
        XoiStep(kind=s["type"], label=s["title"], required=bool(s.get("required", True)), seq=s.get("seq", 0))
        for s in steps
        if s.get("type") in ALLOWED_KINDS and s.get("title")
    ]
