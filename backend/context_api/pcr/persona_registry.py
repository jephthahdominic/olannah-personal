"""Stand-in for the persona registry: role -> layout template. Configuration, not code paths."""
from context_api.models import DegradedField, Layout

ROLE_LABELS = {"technician": "Field Technician", "estimator": "Estimator", "dispatcher": "Dispatcher"}

_LAYOUTS = {
    "technician": Layout(template_id="technician.v1", destinations=["jobs", "inventory"]),
}

_DEFAULT = Layout(template_id="platform.default.v1", destinations=[])


def layout_for(role: str) -> tuple[Layout, list[DegradedField]]:
    """Known role -> its layout. Known role with no layout -> platform default + an unmapped_role flag
    (the BRD says the PCR carries this flag and the canvas only reads it)."""
    layout = _LAYOUTS.get(role)
    if layout is not None:
        return layout, []
    return _DEFAULT, [DegradedField(field="layout", reason="unmapped_role")]
