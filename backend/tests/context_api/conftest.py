import json
from pathlib import Path

import pytest

from context_api.config import Settings
from context_api.pcr.pointers import PointerStore
from context_api.sources.mock import MockSources

FIXTURES = Path(__file__).resolve().parent.parent.parent / "sample-data"


def load_json(name: str) -> dict:
    return json.loads((FIXTURES / name).read_text())


@pytest.fixture
def settings() -> Settings:
    # short per-call timeout so "slow" fault tests finish quickly
    return Settings(fixture_dir=FIXTURES, source_timeout=0.05)


@pytest.fixture
def sources() -> MockSources:
    return MockSources(FIXTURES)


@pytest.fixture
def pointers() -> PointerStore:
    return PointerStore()
