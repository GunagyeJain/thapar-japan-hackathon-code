"""The v1 story beats (Acts 1–6), run directly through the m11 actions with the sim clock set for each.

The /demo steps now follow the v2 story (docs/plan/v2.md); tests of the modules these beats exercise
(m3 lookup after a rebooking, m7 meal lists, m10 timeline) run the beats themselves, by name.
"""
from datetime import datetime

from app.core import clock
from app.core.clock import IST, JST
from app.modules.m11_story import actions

BEATS = (
    ("profile", datetime(2026, 10, 23, 18, 10, tzinfo=IST), actions.priya_profile),
    ("rebook", datetime(2026, 10, 24, 23, 2, tzinfo=IST), actions.rebook_drops_meal),
    ("request_again", datetime(2026, 10, 24, 23, 9, tzinfo=IST), actions.request_again),
    ("caterer", datetime(2026, 10, 25, 0, 40, tzinfo=IST), lambda did: actions.caterer_v3(did, acknowledge=True)),
    ("mehta", datetime(2026, 10, 25, 2, 50, tzinfo=IST), actions.reserve_for_mehta),
    ("boarding", datetime(2026, 10, 25, 3, 35, tzinfo=IST), None),
    ("crew", datetime(2026, 10, 25, 5, 20, tzinfo=IST), actions.crew_events),
    ("landed", datetime(2026, 10, 25, 15, 20, tzinfo=JST), None),
)


def run(client, *names: str) -> list[str]:
    """Reset, then run the named beats in story order (all of them when no names are given)."""
    client.post("/api/demo/reset", json={"keep_judges": False})
    did: list[str] = []
    for name, at, action in BEATS:
        if names and name not in names:
            continue
        clock.set(at)
        if action:
            action(did)
    return did
