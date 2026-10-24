"""Replay shared/rules/vectors.json; frontend/src/lib/rules/vectors.test.ts replays the same file."""

import json

import pytest

from app.modules.m1_rules.engine import RULES_DIR, evaluate

VECTORS = json.loads((RULES_DIR / "vectors.json").read_text(encoding="utf-8"))


@pytest.mark.parametrize("count", [VECTORS["count"]], ids=lambda n: f"{n} rule vectors")
def test_all_shared_vectors_pass(count):
    cases = VECTORS["evaluate"]
    failed = [c["id"] for c in cases if evaluate(c["forbid"], c["tags"]) != c["expect"]]
    assert len(cases) == count >= 150
    assert failed == []
