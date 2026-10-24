"""Chaos Mode: the seven scripted JL740 late changes from docs/plan/v2.md, fired in order through the router.

Each beat sets the sim clock, applies its trigger (the 23:02 codeshare ADL, a passenger not boarding, a trolley
running short) and submits the change like any real one. Passengers are picked from the seed by fixed rules,
so every reset gives the same people. A second run after one reset adds nothing.
"""
import threading
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from sqlmodel import Session, select

from app.core import clock
from app.core.clock import IST
from app.core.ids import new_id
from app.core.models import Flight, Passenger
from app.modules.m1_rules import engine
from app.modules.m4_watcher.watcher import simulate
from app.modules.m7_caterer.service import ack, cut_version, latest
from app.modules.m17_passport import service as passport
from app.modules.m18_changes import service, views
from app.modules.m18_changes.context import held_items, no_show_ids, row_of, service_key

PRESET = "jl740"
PRIYA_SEAT, PRIYA_NEW_PNR = "23C", "8MZ2TN"  # as in the m11 story and m4's simulator
MEHTA_SEAT = "31K"
SWATI_SEAT = "30C"  # m17 seed: no passport; tells check-in she is diabetic
CAST = {"PX-0007", "PX-0057", "PX-0106", "PX-0109", "PX-0122"}  # 2A Sushila, Priya, 29H Meena, Swati, Mehta
SIDE_PAIRS = {"Y": ("AC", "DE", "EF", "FG", "HK"), "C": ("CD", "GH")}  # seats next to each other, same side of an aisle
BACK_ROWS = 3  # "a back-row passenger": the last three economy rows
TROLLEY_ROWS = (34, 39)
TROLLEY_SHORT = 3  # the crew report three fewer paneer than passengers who can only eat paneer
PANEER = "SPEC-Y-PANEER"
_lock = threading.Lock()


class ChaosError(RuntimeError):
    """The seed doesn't have the passenger a beat needs."""


@dataclass(frozen=True)
class Beat:
    n: int
    at: datetime
    channel: str
    kind: str
    lang: str | None = None


BEATS = (
    Beat(1, datetime(2026, 10, 24, 11, 30, tzinfo=IST), "chat", "family_member"),
    Beat(2, datetime(2026, 10, 24, 23, 2, tzinfo=IST), "feed", "lost_request"),
    Beat(3, datetime(2026, 10, 25, 1, 10, tzinfo=IST), "checkin", "new_need", "hi"),
    Beat(4, datetime(2026, 10, 25, 2, 50, tzinfo=IST), "gate", "new_need", "hi"),
    Beat(5, datetime(2026, 10, 25, 3, 50, tzinfo=IST), "boarding", "no_show"),
    Beat(6, datetime(2026, 10, 25, 6, 10, tzinfo=IST), "crew", "mind_change", "en"),
    Beat(7, datetime(2026, 10, 25, 6, 30, tzinfo=IST), "crew", "run_out"),
)


def _key(n: int) -> str:
    return f"chaos:{PRESET}:{n}"


def _cabin(session: Session, flight: Flight) -> list[Passenger]:
    rows = session.exec(select(Passenger).where(Passenger.flight_id == flight.id, Passenger.is_judge == False)).all()  # noqa: E712
    return sorted(rows, key=service_key)


def _at_seat(session: Session, flight: Flight, seat: str) -> Passenger:
    pax = session.exec(select(Passenger).where(Passenger.flight_id == flight.id, Passenger.seat == seat)).first()
    if pax is None:
        raise ChaosError(f"No passenger in {seat}")
    return pax


def _silent(session: Session, p: Passenger) -> bool:
    """Told us nothing: no special meal, no passport or profile, nothing held."""
    return not p.ssr_meal and passport.rules_for(session, p.id) is None and not held_items(session, p.id)


# ---------------------------------------------------------------- who each beat is about


def companion(session: Session, flight: Flight) -> tuple[Passenger, Passenger]:
    """(companion, the passenger who booked a special meal). A booking of 2+ where only one has a meal request;
    the seed has none, so: the same-side seat neighbour of the first special-meal booking outside the group and
    the story cast who has told us nothing."""
    pax = _cabin(session, flight)
    by_pnr: dict[str, list[Passenger]] = defaultdict(list)
    for p in pax:
        by_pnr[p.pnr].append(p)
    for group in by_pnr.values():
        with_meal = [p for p in group if p.ssr_meal]
        if len(group) >= 2 and len(with_meal) == 1:
            return next(p for p in group if not p.ssr_meal), with_meal[0]
    by_seat = {p.seat: p for p in pax}
    for booker in pax:
        if not booker.ssr_meal or booker.group or booker.id in CAST:
            continue
        row, letter = booker.seat[:-1], booker.seat[-1]
        for pair in SIDE_PAIRS[booker.cabin]:
            if letter in pair:
                other = by_seat.get(row + pair.replace(letter, ""))
                if other and other.id not in CAST and _silent(session, other):
                    return other, booker
    raise ChaosError("No travelling companion of a special-meal booking")


def no_show_passenger(session: Session, flight: Flight) -> Passenger:
    """The first plain AVML special meal in service order outside the story cast."""
    for p in _cabin(session, flight):
        held = [i for i in held_items(session, p.id) if i.kind == "special" and i.spec_id == "SPEC-AVML"]
        if held and p.id not in CAST and p.ssr_meal == "AVML":
            return p
    raise ChaosError("No AVML passenger outside the story")


def fast_passenger(session: Session, flight: Flight) -> Passenger:
    """The first passenger in service order in the last three economy rows who has told us nothing."""
    pax = [p for p in _cabin(session, flight) if p.cabin == "Y"]
    last = max(row_of(p.seat) for p in pax)
    for p in pax:
        if row_of(p.seat) > last - BACK_ROWS and p.id not in CAST and p.id not in no_show_ids(session, flight.id) \
                and _silent(session, p):
            return p
    raise ChaosError("No silent passenger in the back rows")


def paneer_only(session: Session, flight: Flight) -> list[Passenger]:
    """On board in the trolley's rows, nothing held, and the paneer is the only main their rules allow."""
    gone = no_show_ids(session, flight.id)
    out = []
    for p in _cabin(session, flight):
        if not TROLLEY_ROWS[0] <= row_of(p.seat) <= TROLLEY_ROWS[1] or p.id in gone or held_items(session, p.id):
            continue
        rules = passport.rules_for(session, p.id)
        plan = passport.plan_for(session, p, rules) if rules else {}
        if plan.get("main_pick") == PANEER and not plan.get("any_main"):
            out.append(p)
    return out


# ---------------------------------------------------------------- the beats


def _rules(presets: list[str], **tiers: str) -> dict[str, Any]:
    combined = engine.combine_presets(presets)
    rules = passport.make_rules(combined["forbid"], combined["allow"])
    return {**rules, "tiers": {**rules["tiers"], **{t: tier for t, tier in tiers.items() if t in rules["forbid"]}}}


def _beat(session: Session, flight: Flight, beat: Beat) -> dict[str, Any]:
    """The change for one beat, after its trigger: submit_change keyword arguments."""
    common = {"flight_id": flight.id, "channel": beat.channel, "kind": beat.kind, "lang": beat.lang,
              "at": beat.at, "chaos_key": _key(beat.n)}
    if beat.n == 1:
        who, booker = companion(session, flight)
        return {**common, "passenger_id": who.id, "rules": _rules(["jain"]),
                "note": f"Travelling with {booker.seat} ({booker.ssr_meal} booked); asks on the chat for the same care for {who.seat}"}
    if beat.n == 2:
        priya = _at_seat(session, flight, PRIYA_SEAT)
        if priya.pnr != PRIYA_NEW_PNR:  # the story's 23:02 ADL: the codeshare rebooking drops her meal; m4 raises LOST_MEAL
            simulate("rebook_drop_meal", priya.id, session=session)
        return {**common, "passenger_id": priya.id, "note": "Codeshare rebooking 6XK2QP → 8MZ2TN arrived without the meal request"}
    if beat.n == 3:
        swati = _at_seat(session, flight, SWATI_SEAT)
        return {**common, "passenger_id": swati.id, "rules": _rules(["diabetic"], sugar="firm", honey="firm"),
                "note": "Tells check-in she can't have sugar (medical)"}
    if beat.n == 4:
        mehta = _at_seat(session, flight, MEHTA_SEAT)
        return {**common, "passenger_id": mehta.id, "rules": _rules(["jain"]),
                "note": "Asks at the gate: no meat, egg, onion family, root vegetables or honey"}
    if beat.n == 5:
        return {**common, "passenger_id": no_show_passenger(session, flight).id, "note": "Did not board"}
    if beat.n == 6:
        who = fast_passenger(session, flight)
        fast = {"id": "TR-1", "kind": "dates", "dates": [flight.date], "preset": "vrat"}
        return {**common, "passenger_id": who.id, "rules": {**passport.make_rules([], time_rules=[fast])},
                "note": "Realises today is a fast day and asks the crew"}
    return _run_out(session, flight, beat, common)


def _run_out(session: Session, flight: Flight, beat: Beat, common: dict[str, Any]) -> dict[str, Any]:
    """Trolley 2 reaches row 34 three paneer short: the first short passengers get the fixes the ladder finds
    (recorded on the event), the last one is the event itself."""
    need = paneer_only(session, flight)
    if len(need) < TROLLEY_SHORT:
        raise ChaosError("Not enough passengers who can only eat the paneer in rows 34-39")
    short = need[-TROLLEY_SHORT:]
    change_id = new_id("CH")
    also = [service.fix_quietly(session, flight, p, kind="run_out", channel=beat.channel, at=beat.at,
                                change_id=change_id, rows=TROLLEY_ROWS) for p in short[:-1]]
    seats = ", ".join(p.seat for p in short)
    note = (f"Trolley 2 reaches row {TROLLEY_ROWS[0]} with {len(need) - TROLLEY_SHORT} paneer for {len(need)} passengers "
            f"who can only eat paneer; short: {seats}")
    return {**common, "passenger_id": short[-1].id, "note": note, "change_id": change_id, "rows": TROLLEY_ROWS,
            "run_out_seats": seats, "also": also}


CATERER_ON_DUTY = "Skyline Flight Kitchens · shift lead"


def _final_list(session: Session, flight: Flight) -> None:
    """The caterer's final list goes out at 00:40, carrying the changes the kitchen still had time for,
    and the kitchen acknowledges it (C3 for every promise on it)."""
    last = latest(session, flight.id)
    if last is None or last.created_at < flight.caterer_final_list_at:
        clock.set(flight.caterer_final_list_at, session=session)
        last = cut_version(flight.id, at=flight.caterer_final_list_at, session=session)
    if not last.ack_at:
        ack(last.id, CATERER_ON_DUTY, session=session)


def run(session: Session, flight_id: str, preset: str = PRESET) -> dict[str, Any]:
    if preset != PRESET:
        raise ValueError(f"Unknown chaos preset {preset}")
    flight = session.get(Flight, flight_id)
    if flight is None:
        raise LookupError(f"No flight {flight_id}")
    with _lock:
        events = []
        for beat in BEATS:
            done = views.events_of(session, flight_id)
            existing = next((e for e in done if e.chaos_key == _key(beat.n)), None)
            if existing is None:
                if beat.n == 3:
                    _final_list(session, flight)
                clock.set(beat.at, session=session)
                existing = service.submit_change(session, **_beat(session, flight, beat))
                session.commit()
            events.append(existing)
        clock.set(BEATS[-1].at, session=session)
        session.commit()
        return {"events": [service.event_payload(e) for e in events], "metrics": views.metrics(session, flight)}
