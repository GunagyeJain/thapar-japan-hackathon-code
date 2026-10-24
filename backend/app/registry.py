"""Module registry. Shared zone: one line per module, add yours, don't reorder.

Reset (POST /api/demo/reset) calls every seed() in this order, m0 first.
"""
from collections.abc import Callable
from dataclasses import dataclass

from fastapi import APIRouter
from sqlmodel import Session

from app.core import router as core_router
from app.core import seed as core_seed
from app.modules import (
    m1_rules,
    m3_passenger,
    m4_watcher,
    m6_matcher,
    m7_caterer,
    m8_crew,
    m9_recipes,
    m10_insights,
    m11_story,
    m14_groups,
)


@dataclass(frozen=True)
class Module:
    id: str
    name: str
    router: APIRouter
    seed: Callable[[Session], None]


MODULES: list[Module] = [
    Module("m0", "core", core_router.router, core_seed.seed),
    Module("m1", "rules engine", m1_rules.router, m1_rules.seed),
    Module("m3", "passenger + judge join", m3_passenger.router, m3_passenger.seed),
    Module("m4", "lost-meal watcher", m4_watcher.router, m4_watcher.seed),
    Module("m6", "late-request matcher", m6_matcher.router, m6_matcher.seed),
    Module("m7", "caterer", m7_caterer.router, m7_caterer.seed),
    Module("m8", "crew tablet", m8_crew.router, m8_crew.seed),
    Module("m9", "hidden-ingredient check", m9_recipes.router, m9_recipes.seed),
    Module("m10", "insights", m10_insights.router, m10_insights.seed),
    Module("m11", "story engine", m11_story.router, m11_story.seed),
    Module("m14", "groups", m14_groups.router, m14_groups.seed),
]
