"""What is still physically possible at a given minute: one flight's windows, their rungs, and airport config.

Windows come from the core Flight milestones (docs/plan/v2.md, "Time windows"). A delay moves dispatch,
boarding and departure; the special-meal cutoff and the caterer's final list stay where they were.
"""
from datetime import datetime, timedelta
from typing import Any

from app.core import clock
from app.core.models import Flight

ONBOARD_RUNGS = ("onboard_spare", "noshow_release", "reserve_pouch", "flex_swap", "sunrise_box", "unmet")
RUNGS: dict[str, tuple[str, ...]] = {
    "ssr": ("ssr_change", "unmet"),
    "caterer_list": ("caterer_add", "unmet"),
    "standby_uplift": ("standby_uplift", *ONBOARD_RUNGS),
    "airport": ("lounge", "airside_partner", *ONBOARD_RUNGS),
    "onboard": ONBOARD_RUNGS,
    "inflight": ONBOARD_RUNGS,
}
# A main course that ran out: first fresh food that would otherwise be thrown away (spares, no-show meals),
# then a flex swap; the never-spoiling pouches stay for needs only a special meal can meet.
RUN_OUT_RUNGS = ("onboard_spare", "noshow_release", "flex_swap", "reserve_pouch", "sunrise_box", "unmet")
BEFORE_BOARDING = ("standby_uplift", "airport", "onboard")  # the passenger can still be told on the ground

# Airport config (m18 owns it). Hours are local (IST for DEL).
AIRPORTS: dict[str, dict[str, Any]] = {
    "DEL": {
        "lounge": {"name": "ENCALM lounge, DEL T3", "cabins": ("C",), "hours": (0, 24)},
        "airside_partner": {"name": "DEL T3 airside partner outlets", "closed": (0, 5)},  # closed 00:00–05:00
    },
}
# The caterer's standby bank per flight number: meals it can still put on the truck after the final list.
# The counts are an assumption (labelled as such in every reason that uses them).
STANDBY_BANK: dict[str, dict[str, Any]] = {
    "JL740": {"caterer": "Skyline Flight Kitchens", "stock": {"AVML": 2, "VJML": 1, "DBML": 1, "VGML": 1}},
}
FLEX_MILES = 300


def _late(flight: Flight) -> timedelta:
    return timedelta(minutes=flight.delay_min or 0)


def edges(flight: Flight) -> list[tuple[str, datetime | None, datetime | None]]:
    """(window, from, to) in order; `from` of the first and `to` of the last are open."""
    late = _late(flight)
    dispatch, boarding, std = flight.dispatch_at + late, flight.boarding_at + late, flight.std + late
    return [
        ("ssr", None, flight.special_meal_cutoff),
        ("caterer_list", flight.special_meal_cutoff, flight.caterer_final_list_at),
        ("standby_uplift", flight.caterer_final_list_at, dispatch),
        ("airport", dispatch, boarding),
        ("onboard", boarding, std),
        ("inflight", std, None),
    ]


def dispatch(flight: Flight) -> datetime:
    return flight.dispatch_at + _late(flight)


def _ist(at: datetime | None) -> datetime | None:
    return at.astimezone(clock.IST) if at else None


def milestones(flight: Flight) -> list[dict[str, Any]]:
    """Ordered windows with from/to (IST) and the rungs the router tries in each, best first."""
    return [{"window": w, "from": _ist(a), "to": _ist(b), "rungs": list(RUNGS[w])} for w, a, b in edges(flight)]


def window_at(flight: Flight, at: datetime) -> str:
    for window, start, end in edges(flight):
        if (start is None or at >= start) and (end is None or at < end):
            return window
    return "inflight"


def rungs_for(window: str, kind: str) -> tuple[str, ...]:
    rungs = RUNGS[window]
    if kind != "run_out":
        return rungs
    return (*(r for r in rungs if r not in ONBOARD_RUNGS), *RUN_OUT_RUNGS)


def lounge(airport: str) -> dict[str, Any] | None:
    return AIRPORTS.get(airport, {}).get("lounge")


def airside_partner(airport: str) -> dict[str, Any] | None:
    return AIRPORTS.get(airport, {}).get("airside_partner")


def partner_open(partner: dict[str, Any], at: datetime) -> bool:
    start, end = partner["closed"]
    return not start <= at.astimezone(clock.IST).hour < end


def bank(flight: Flight) -> dict[str, Any] | None:
    return STANDBY_BANK.get(flight.flight_no)


def hhmm(at: datetime) -> str:
    return f"{at.astimezone(clock.IST):%H:%M}"
