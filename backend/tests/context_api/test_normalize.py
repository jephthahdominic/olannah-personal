from datetime import date

import pytest

from context_api.normalize import (
    normalize_equipment_id,
    normalize_site,
    parse_iso_datetime,
    parse_us_date,
    parse_yyyymmdd,
    sentence_case,
)


@pytest.mark.parametrize(
    "raw, expected",
    [
        ("COMPRESSOR TRIPPED ON HIGH PRESSURE. REPLACED DISCHARGE VALVE.", "Compressor tripped on high pressure. Replaced discharge valve."),
        ("DISCHARGE VALVE ZR72", "Discharge valve ZR72"),  # tokens with digits keep their case
        ("ANNUAL PM", "Annual PM"),
        ("Short cycling. Cleaned coil.", "Short cycling. Cleaned coil."),  # mixed case is left alone
        (None, None),
        ("", ""),
    ],
)
def test_sentence_case(raw, expected):
    assert sentence_case(raw) == expected


def test_parse_yyyymmdd():
    assert parse_yyyymmdd("20260814") == date(2026, 8, 14)
    assert parse_yyyymmdd("bad-date") is None
    assert parse_yyyymmdd(None) is None


@pytest.mark.parametrize(
    "raw, expected",
    [
        ("3/2/2026", date(2026, 3, 2)),
        ("11/20/2023", date(2023, 11, 20)),
        ("2026-03-02", date(2026, 3, 2)),
        ("13/45/2026", None),
        ("", None),
        (None, None),
    ],
)
def test_parse_us_date(raw, expected):
    assert parse_us_date(raw) == expected


def test_parse_iso_datetime():
    assert parse_iso_datetime("2026-10-22T16:40:00-05:00").hour == 16
    assert parse_iso_datetime("not-a-date") is None


def test_normalize_equipment_id_collapses_typing_variants():
    assert {normalize_equipment_id(v) for v in ("E-2231", "E2231", "e-2231", " E 2231 ")} == {"E2231"}


def test_normalize_site_collapses_naming_variants():
    assert {normalize_site(v) for v in ("Store 118", "STORE 118", "STORE #118")} == {"118"}
