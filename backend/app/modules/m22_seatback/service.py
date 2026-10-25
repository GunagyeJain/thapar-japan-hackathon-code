"""m22 · seatback meal check: 30–45 min before the meal, each seat with a special or held meal asks "still right?".

- Yes: the copilot shows the seat as confirmed at the seat, so crew bring that tray first. The tray scan stays the
  final check: a tap on a screen doesn't prove who is sitting there.
- No, skip: the tray is free for the next request on board (m18's release rung reads `released_items`).
- Change: the passenger picks from what is on board that fits all their food rules on the flight date (m1) and
  isn't owed to anyone else (m6's inventory). Reserve pouches stay for needs only they can meet.
- No answer for NO_ANSWER: the crew ask in person.

The aircraft server is the demo laptop: seat screens and the crew tablet reach it over the cabin network, so the
answers reach the tablet live while it is connected. The offline crew package is unchanged.
"""
from collections import Counter
from datetime import datetime, timedelta
from typing import Any

from sqlmodel import Session, func, select

from app.core import clock, events, outbox
from app.core.ids import new_id
from app.core.models import Flight, MealItem, MealPromise, MealSpec, Passenger
from app.modules.m6_matcher import inventory
from app.modules.m6_matcher.models import LateRequest
from app.modules.m18_changes import service as router
from app.modules.m18_changes.context import (
    USABLE, day_rules, fits, galley_for, held_items, mark_for, no_show_ids, normalize, passenger_lang, row_of,
)
from app.modules.m18_changes.models import ChangeEvent
from app.modules.m18_changes.rungs import released_on
from app.modules.m22_seatback.models import SeatAsk

NO_ANSWER = timedelta(minutes=10)
ANSWERS = ("yes", "no", "change")
STATUS_OF = {"yes": "confirmed", "no": "skipped", "change": "changed"}
ANSWERED = tuple(STATUS_OF.values())
SOURCE = "seat screen"
OPTION_ORDER = {"freed": 0, "spare": 1, "main": 2}  # fresh food that would otherwise be thrown away first


class NotAsked(Exception):
    """An answer from a seat nobody has asked yet."""


# ---------------------------------------------------------------- lookups


def _flight(session: Session, flight_id: str) -> Flight:
    flight = session.get(Flight, flight_id)
    if flight is None:
        raise LookupError(f"No flight {flight_id}")
    return flight


def _at_seat(session: Session, flight: Flight, seat: str) -> Passenger | None:
    """Who is booked in this seat and boarded (a no-show's seat is empty)."""
    pax = session.exec(select(Passenger).where(Passenger.flight_id == flight.id, Passenger.seat == seat)).first()
    return None if pax is None or pax.id in no_show_ids(session, flight.id) else pax


def _question(session: Session, flight_id: str, passenger_id: str) -> SeatAsk | None:
    return session.exec(select(SeatAsk).where(SeatAsk.flight_id == flight_id, SeatAsk.passenger_id == passenger_id)).first()


def _seat_key(seat: str) -> tuple[int, str]:
    return row_of(seat), seat


def initials(p: Passenger) -> str:
    """"P. S.": all a seat screen shows of who sits there."""
    given = (p.given or p.display_name or "").strip()
    return " ".join(f"{part[0].upper()}." for part in (given, p.surname or "") if part)


def eligible(session: Session, flight_id: str) -> dict[str, dict[str, Any]]:
    """passenger_id → the tray (or main course) held for them: the router's onboard plan (m18), first row each."""
    out: dict[str, dict[str, Any]] = {}
    for row in router.assignments(session, flight_id):
        out.setdefault(row["passenger_id"], row)
    return out


def _state(q: SeatAsk, now: datetime) -> str:
    return "no_answer" if q.status == "asked" and now - q.asked_at >= NO_ANSWER else q.status


def rules_of(session: Session, pax: Passenger) -> dict[str, Any] | None:
    """What we know they can't eat: the passport, profile or booked code (as the router reads it), else the last
    late change the router took for them (a gate request has no passport), else an m6 late request."""
    rules = router.resolve_rules(session, pax, None, "new_need")
    if rules:
        return rules
    last = session.exec(select(ChangeEvent).where(ChangeEvent.passenger_id == pax.id, ChangeEvent.kind != "no_show")
                        .order_by(ChangeEvent.seq.desc())).first()  # type: ignore[union-attr]
    if last and last.request.get("forbid"):
        req = last.request
        return normalize({"forbid": req["forbid"], "allow": req.get("allow", []), "allergens": req.get("allergens", []),
                          "tiers": req.get("tiers", {})})
    late = session.exec(select(LateRequest).where(LateRequest.passenger_id == pax.id)
                        .order_by(LateRequest.at.desc())).first()  # type: ignore[union-attr]
    return normalize({"forbid": list(late.forbid)}) if late and late.forbid else None


def _rules_mark(session: Session, flight: Flight, pax: Passenger) -> dict[str, str] | None:
    """The tray's label mark from the passenger's rules on the flight date (food rules, never a diet's name)."""
    rules = rules_of(session, pax)
    if rules:
        day, _, _ = day_rules(rules, flight)
        return mark_for(day)
    promise = session.exec(select(MealPromise).where(MealPromise.passenger_id == pax.id)).first()
    return dict(promise.label_mark) if promise and promise.label_mark else None


def _meal(session: Session, item_id: str | None, spec_id: str | None) -> dict[str, Any]:
    item = session.get(MealItem, item_id) if item_id else None
    spec = session.get(MealSpec, item.spec_id if item else spec_id) if (item or spec_id) else None
    return {"item_id": item.id if item else None, "spec_id": spec.id if spec else None,
            "name": dict(spec.name) if spec else None, "code": spec.code if spec else None,
            "galley": item.galley if item else None}


# ---------------------------------------------------------------- the crew press "Ask seats now"


def ask(session: Session, flight_id: str) -> dict[str, Any]:
    """Ask every seat with a special or held meal. Seats that already answered keep their answer."""
    flight = _flight(session, flight_id)
    now = clock.now(session=session)
    top = session.exec(select(func.max(SeatAsk.round)).where(SeatAsk.flight_id == flight_id)).one()
    rnd = (top or 0) + 1
    asked = 0
    for pid, row in eligible(session, flight_id).items():
        q = _question(session, flight_id, pid)
        if q is not None and q.status in ANSWERED:
            continue
        held = "main" if row.get("source") == "main_pick" else "special"
        q = q or SeatAsk(id=new_id("SA"), flight_id=flight_id, passenger_id=pid, seat=row["seat"], round=rnd, asked_at=now)
        q.seat, q.round, q.asked_at, q.status, q.held = row["seat"], rnd, now, "asked", held
        q.item_id = row.get("item_id") if held == "special" else None
        q.spec_id = row.get("spec_id")
        session.add(q)
        asked += 1
    outbox.notify("crew", f"crew:{flight.flight_no}", f"Seat screens asked {asked} passengers",
                  f"{asked} passengers with a special or held meal were asked on their seat screen at {now:%H:%M} IST. "
                  f"No answer within {int(NO_ANSWER.total_seconds() // 60)} min: ask in person.",
                  ref={"kind": "seatback", "round": rnd}, session=session)
    session.flush()
    return status(session, flight_id)


def status(session: Session, flight_id: str) -> dict[str, Any]:
    """The crew's view: every seat asked, with its answer (or no answer yet)."""
    _flight(session, flight_id)
    now = clock.now(session=session)
    rows = session.exec(select(SeatAsk).where(SeatAsk.flight_id == flight_id)).all()
    seats = [
        {"seat": q.seat, "passenger_id": q.passenger_id, "status": _state(q, now), "held": q.held,
         "asked_at": q.asked_at, "answered_at": q.answered_at, "item_id": q.item_id, "spec_id": q.spec_id,
         "new_item_id": q.new_item_id, "released_item_id": q.released_item_id}
        for q in sorted(rows, key=lambda q: _seat_key(q.seat))
    ]
    counts = Counter(s["status"] for s in seats)
    return {
        "flight_id": flight_id, "now": now,
        "round": max((q.round for q in rows), default=0),
        "asked_at": max((q.asked_at for q in rows), default=None),
        "no_answer_after_min": int(NO_ANSWER.total_seconds() // 60),
        "counts": {k: counts.get(k, 0) for k in ("asked", "confirmed", "skipped", "changed", "no_answer")},
        "seats": seats,
    }


# ---------------------------------------------------------------- the seat screen


def seat_view(session: Session, flight_id: str, seat: str) -> dict[str, Any]:
    """What one seat screen shows: initials only; the meal's details travel along but show after a tap."""
    flight = _flight(session, flight_id)
    now = clock.now(session=session)
    base = {"flight": {"id": flight.id, "flight_no": flight.flight_no, "origin": flight.origin, "dest": flight.dest,
                       "std": flight.std, "sta": flight.sta},
            "seat": seat, "now": now}
    pax = _at_seat(session, flight, seat)
    if pax is None:
        return {**base, "occupied": False, "initials": None, "lang": "en", "ask": None}
    q = _question(session, flight_id, pax.id)
    view = None
    if q is not None:
        view = {"id": q.id, "status": _state(q, now), "held": q.held, "asked_at": q.asked_at,
                "answered_at": q.answered_at, "meal": {**_meal(session, q.item_id, q.spec_id),
                                                       "mark": _rules_mark(session, flight, pax)},
                "choice": _meal(session, q.new_item_id, None) if q.new_item_id else None}
    return {**base, "occupied": True, "initials": initials(pax), "lang": passenger_lang(session, pax, None), "ask": view}


def _pool(session: Session, flight: Flight) -> list[tuple[MealItem, str]]:
    """Trays nobody holds that a passenger may take: freed meals, spare specials, and mains above the count owed."""
    inv = inventory.load(session, flight.id)
    pool = [(i, "spare" if i.kind == "spare" else "main") for i in inv.items
            if i.id in inv.free_ids and i.kind in ("spare", "main")]
    return [*((item, "freed") for _, item, _ in released_on(session, flight.id)), *pool]


def options(session: Session, flight_id: str, seat: str) -> dict[str, Any]:
    """Change: what is on board that fits every food rule this passenger has on the flight date, one per dish."""
    flight = _flight(session, flight_id)
    pax = _at_seat(session, flight, seat)
    if pax is None:
        raise LookupError(f"No passenger in {seat}")
    rules = rules_of(session, pax)
    if rules is None:  # nothing known to check a swap against: the crew ask in person
        return {"seat": seat, "rules_known": False, "options": []}
    forbid = day_rules(rules, flight)[0]["forbid"]
    held = held_items(session, pax.id)
    mine = {i.id for i in held}
    row = eligible(session, flight.id).get(pax.id)
    same = {i.spec_id for i in held} | ({row["spec_id"]} if row and row.get("spec_id") else set())  # their own dish
    groups: dict[str, dict[str, Any]] = {}
    for item, source in _pool(session, flight):
        spec = session.get(MealSpec, item.spec_id)
        if item.id in mine or spec is None or spec.id in same or inventory.menu_cabin(spec.id) not in (None, pax.cabin):
            continue
        if not fits(spec, forbid):
            continue
        group = groups.setdefault(spec.id, {"spec_id": spec.id, "name": dict(spec.name), "code": spec.code,
                                            "source": source, "items": []})
        group["items"].append(item)
    out = []
    for g in groups.values():
        item = next((i for i in g["items"] if i.galley == galley_for(pax.seat)), g["items"][0])
        out.append({"spec_id": g["spec_id"], "name": g["name"], "code": g["code"], "source": g["source"],
                    "count": len(g["items"]), "item_id": item.id, "galley": item.galley})
    return {"seat": seat, "rules_known": True,
            "options": sorted(out, key=lambda o: (OPTION_ORDER[o["source"]], o["spec_id"]))}


# ---------------------------------------------------------------- answers


def _crew(session: Session, flight: Flight, title: str, body: str, **ref: Any) -> None:
    outbox.notify("crew", f"crew:{flight.flight_no}", title, body, ref={"kind": "seatback", **ref}, session=session)


def _timeline(session: Session, flight: Flight, pax: Passenger, q: SeatAsk, now: datetime, detail: str) -> None:
    """A C5 info line on the promise timeline; the checkpoint itself stays as it is (the tray scan sets it)."""
    promise = session.exec(select(MealPromise).where(MealPromise.passenger_id == pax.id)).first()
    events.record_checkpoint(promise.id if promise else None, pax.id, flight.id, "C5", "info", SOURCE, detail,
                             data={"seatback": q.id, "status": q.status}, key=f"m22:{q.id}:{q.status}:{now.isoformat()}",
                             at=now, session=session)


def _tray_line(session: Session, item: MealItem | None) -> str:
    if item is None:
        return "the main course held for them"
    spec = session.get(MealSpec, item.spec_id)
    return f"{item.id} ({spec.name['en'] if spec else item.spec_id}, galley {item.galley[-1]})"


def _confirm(session: Session, flight: Flight, pax: Passenger, q: SeatAsk) -> str:
    if q.status == "skipped" and q.released_item_id:  # "No" by mistake: take the tray back if nobody has it yet
        item = session.get(MealItem, q.released_item_id)
        if item and item.assigned_passenger_id is None and item.status in USABLE:
            item.assigned_passenger_id = pax.id
            session.add(item)
            q.item_id, q.released_item_id = item.id, None
    tray = session.get(MealItem, q.item_id) if q.item_id else None
    _crew(session, flight, f"{pax.seat}: confirmed at seat",
          f"{pax.seat} confirmed {_tray_line(session, tray)} on the seat screen: bring it first and scan it at the seat.",
          seat=pax.seat, item_id=q.item_id)
    return f"Confirmed {_tray_line(session, tray)} on the seat screen"


def _release(session: Session, pax: Passenger) -> MealItem | None:
    """Free everything held for the passenger; the tray that matters (their special meal first) comes back."""
    held = held_items(session, pax.id)
    for item in held:
        item.assigned_passenger_id = None
        session.add(item)
    return held[0] if held else None


def _skip(session: Session, flight: Flight, pax: Passenger, q: SeatAsk) -> str:
    freed = _release(session, pax)
    q.released_item_id = freed.id if freed else None
    what = f"{_tray_line(session, freed)} is free for another request on board" if freed else "no tray was held"
    _crew(session, flight, f"{pax.seat}: skipping the meal", f"{pax.seat} said no on the seat screen: {what}.",
          seat=pax.seat, item_id=freed.id if freed else None)
    return f"Skipped the meal on the seat screen: {what}"


def _change(session: Session, flight: Flight, pax: Passenger, q: SeatAsk, item_id: str | None) -> str:
    offered = {o["item_id"] for o in options(session, flight.id, pax.seat)["options"]}
    new = session.get(MealItem, item_id) if item_id else None
    if new is None or item_id not in offered:
        raise ValueError("That meal isn't free for this seat any more: pick again")
    old = _release(session, pax)
    new.assigned_passenger_id = pax.id
    session.add(new)
    taking_back = q.released_item_id == new.id  # they skipped it earlier and picked it again
    q.released_item_id = old.id if old else (None if taking_back else q.released_item_id)
    q.new_item_id, q.item_id, q.spec_id = new.id, new.id, new.spec_id
    freed = f"; {old.id} is free for another request" if old else ""
    _crew(session, flight, f"{pax.seat}: changed at seat",
          f"{pax.seat} picked {_tray_line(session, new)} on the seat screen{freed}. Scan it at the seat.",
          seat=pax.seat, item_id=new.id, released_item_id=old.id if old else None)
    return f"Changed on the seat screen to {_tray_line(session, new)}"


def answer(session: Session, flight_id: str, seat: str, given: str, item_id: str | None = None) -> dict[str, Any]:
    """Yes, No (skip) or Change, from the seat screen. Raises LookupError, ValueError or NotAsked."""
    if given not in ANSWERS:
        raise ValueError(f"Unknown answer {given!r}")
    flight = _flight(session, flight_id)
    pax = _at_seat(session, flight, seat)
    if pax is None:
        raise LookupError(f"No passenger in {seat}")
    q = _question(session, flight_id, pax.id)
    if q is None:
        raise NotAsked(f"{seat} hasn't been asked yet: the crew start it with Ask seats now")
    now = clock.now(session=session)
    if given == "yes":
        detail = _confirm(session, flight, pax, q)
    elif given == "no":
        detail = _skip(session, flight, pax, q)
    else:
        detail = _change(session, flight, pax, q, item_id)
    q.status, q.answered_at = STATUS_OF[given], now
    session.add(q)
    _timeline(session, flight, pax, q, now, detail)
    session.flush()
    return seat_view(session, flight_id, seat)


# ---------------------------------------------------------------- for the change router (m18)


def released_items(session: Session, flight_id: str) -> list[tuple[str, MealItem]]:
    """Trays given up on a seat screen, as (seat, tray); m18 checks that nobody holds them again."""
    rows = session.exec(select(SeatAsk).where(SeatAsk.flight_id == flight_id, SeatAsk.released_item_id.is_not(None))).all()  # type: ignore[union-attr]
    out = []
    for q in rows:
        item = session.get(MealItem, q.released_item_id)
        if item is not None:
            out.append((q.seat, item))
    return out
