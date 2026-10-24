"""Replay shared/rules/vectors.json; frontend/src/lib/rules/vectors.test.ts replays the same file."""

import json

from app.modules.m1_rules.engine import RULES_DIR, evaluate

VECTORS = json.loads((RULES_DIR / "vectors.json").read_text(encoding="utf-8"))


def test_all_shared_vectors_pass():
    cases = VECTORS["evaluate"]
    failed = [c["id"] for c in cases if evaluate(c["forbid"], c["tags"]) != c["expect"]]
    print(f"\n{len(cases)} rule vectors checked (python)")
    assert len(cases) == VECTORS["count"] >= 150
    assert failed == []
