"""m20 · crew copilot: for each seat, how strict the passenger is, which tray to hand over and when they may eat.

It rides in the crew package, so the tablet has it in airplane mode. Sources:
- m17 (passports): tier, flex and the crew card, for the rules that apply on the flight date.
- m18 (change router) when it is on this branch: its onboard plan wins for every passenger it covers.
  Without it, trays come from the core meal items (specials, spares, backups) plus, when only one main
  fits someone's rules, that main held for them.
- m21 (sun at the aircraft) when it is on this branch: when a daylight-only eater may eat, or a Sunrise Box.
Crew taps (eaten, refused, swapped) come back from the crew event log.
"""
import logging
from collections.abc import Iterable
from typing import Any

from sqlmodel import Session, select

from app.core.models import Flight, MealItem, MealSpec, Passenger
from app.modules.m8_crew.models import CrewEventLog
from app.modules.m17_passport import service as passport

log = logging.getLogger(__name__)

TAP_TYPES = ("eaten", "refused", "swapped")
SUN_KINDS = ("daylight", "dawn_to_sunset")
TIER_RANK = {"hard": 0, "firm": 1, "soft": 2, "none": 3}
# Which rung of the ladder put a core meal item in front of the passenger.
RUNG_BY_KIND = {"special": "ssr_change", "spare": "onboard_spare", "backup": "reserve_pouch", "main": "held_main"}
KIND_PREFERENCE = {"special": 0, "spare": 1, "backup": 2, "main": 3}
LAST_G1_ROW = 29  # rows up to 29 are served from galley 1, the rest from galley 2 (same split as the seed)
OPEN_STATUSES = ("planned", "loaded")


def _row(seat: str) -> int:
    digits = "".join(ch for ch in seat if ch.isdigit())
    return int(digits) if digits else 0


def galley_for(seat: str) -> str:
    return "G1" if _row(seat) <= LAST_G1_ROW else "G2"


def _late_forbid(session: Session, flight_id: str) -> dict[str, list[str]]:
    """What a late request at the gate or desk said the passenger can't eat (m6), newest wins."""
    try:
        from app.modules.m6_matcher.models import LateRequest
    except ImportError:
        return {}
    rows = session.exec(select(LateRequest).where(LateRequest.flight_id == flight_id)).all()
    return {r.passenger_id: list(r.forbid) for r in sorted(rows, key=lambda r: r.at) if r.forbid}


def _known_rules(session: Session, flight: Flight, passengers: list[Passenger],
                 booked: dict[str, dict[str, Any]]) -> dict[str, dict[str, Any]]:
    """Rules per passenger: the passport (or v1 profile), else a late request, else what the booked code excludes.

    `booked` is the package's `forbid` block (profile, or the booked code and its kitchen note).
    """
    cabin = {row["passenger_id"]: row for row in passport.cabin(session, flight.id)}
    late = _late_forbid(session, flight.id)
    out: dict[str, dict[str, Any]] = {}
    for pax in passengers:
        row = cabin.get(pax.id)
        if row and row["rules"]:
            out[pax.id] = {"rules": row["rules"], "source": row["source"] or "passport"}
            continue
        forbid = late.get(pax.id) or booked.get(pax.id, {}).get("forbid") or []
        if not forbid:
            continue
        try:
            rules = passport.make_rules(forbid)
        except (KeyError, ValueError):  # a tag the rules engine doesn't know
            log.exception("m20: can't read the rules of %s on %s", pax.id, flight.id)
            continue
        out[pax.id] = {"rules": rules, "source": "late request" if pax.id in late else booked[pax.id]["source"]}
    return out


def _rules_today(rules: dict[str, Any], day: str) -> dict[str, Any]:
    """The rules on the flight date: date and weekday rules add their forbids, with a tier for each tag."""
    today = passport.rules_on(rules, day)
    allergens = rules.get("allergens", [])
    tiers = {t: rules.get("tiers", {}).get(t) or passport.tier_for(t, allergens) for t in today["forbid"]}
    return {**rules, "forbid": today["forbid"], "allow": today["allow"], "tiers": tiers,
            "time_rules_active": today["time_rules_active"]}


def _sun_kind(rules: dict[str, Any]) -> str | None:
    return next((r["kind"] for r in rules.get("time_rules", []) if r.get("kind") in SUN_KINDS), None)


# ---------------------------------------------------------------- m18: the change router's onboard plan

def _router_rows(session: Session, flight_id: str) -> list[dict[str, Any]] | None:
    """m18's assignments, or None when m18 isn't on this branch (or fails: it is built in parallel)."""
    try:
        from app.modules.m18_changes.service import assignments  # type: ignore[import-not-found]
    except ImportError:
        return None
    try:
        out = assignments(session, flight_id)
    except Exception:
        log.exception("m18 assignments failed for %s", flight_id)
        return None
    rows = out.get("assignments", []) if isinstance(out, dict) else out
    if not isinstance(rows, list):
        return None
    good = [r for r in rows if isinstance(r, dict) and (r.get("passenger_id") or r.get("seat"))]
    if len(good) != len(rows):
        log.warning("m20: skipped %d malformed m18 assignments for %s", len(rows) - len(good), flight_id)
    return good


# ---------------------------------------------------------------- m21: sun at the aircraft

def _iso(value: Any) -> str | None:
    if value is None:
        return None
    return value.isoformat() if hasattr(value, "isoformat") else str(value)


def _sun_rows(session: Session, flight_id: str) -> dict[str, dict[str, Any]] | None:
    """m21's seats by passenger, or None when m21 isn't on this branch (or fails)."""
    try:
        from app.modules.m21_sun import service as sun  # type: ignore[import-not-found]
    except ImportError:
        return None
    try:
        fn = getattr(sun, "daylight_seats", None) or getattr(sun, "seats", None)
        if fn is not None:
            rows = fn(session, flight_id)
        else:
            from app.modules.m21_sun.router import seats as seats_route  # type: ignore[import-not-found]

            rows = seats_route(flight_id, session)
        rows = rows.get("seats", []) if isinstance(rows, dict) else rows
    except Exception:
        log.exception("m21 sun seats failed for %s", flight_id)
        return None
    out: dict[str, dict[str, Any]] = {}
    for r in rows or []:
        if not isinstance(r, dict) or not r.get("passenger_id"):
            continue
        out[r["passenger_id"]] = {
            "may_eat_from": _iso(r.get("may_eat_from")),
            "may_eat_until": _iso(r.get("may_eat_until")),
            "sunrise_box": bool(r.get("sunrise_box")),
            "sun_note": r.get("note") if isinstance(r.get("note"), dict) else None,
        }
    return out


# ---------------------------------------------------------------- trays

def _assigned(item: MealItem | None, spec: MealSpec | None, rung: str, spec_name: dict[str, str] | None = None
              ) -> dict[str, Any]:
    """{item_id, spec_id, spec_name, rung}: the tablet finds galley, position and status in the package's items."""
    return {
        "item_id": item.id if item else None,
        "spec_id": spec.id if spec else (item.spec_id if item else None),
        "spec_name": spec_name or (spec.name if spec else {"en": item.spec_id if item else "Meal"}),
        "rung": rung,
    }


def _core_trays(items: Iterable[MealItem]) -> dict[str, MealItem]:
    """The tray each passenger gets from the meal items: a live one first (a backup after a swap beats the missing special)."""
    by_pax: dict[str, list[MealItem]] = {}
    for item in items:
        if item.assigned_passenger_id:
            by_pax.setdefault(item.assigned_passenger_id, []).append(item)
    return {
        pid: min(trays, key=lambda i: (i.status == "missing", KIND_PREFERENCE.get(i.kind, 9), i.id))
        for pid, trays in by_pax.items()
    }


def _router_trays(rows: list[dict[str, Any]], by_seat: dict[str, Passenger], items: dict[str, MealItem],
                  specs: dict[str, MealSpec]) -> dict[str, dict[str, Any]]:
    out: dict[str, dict[str, Any]] = {}
    for r in rows:
        pax_id = r.get("passenger_id") or (by_seat[r["seat"]].id if r.get("seat") in by_seat else None)
        if not pax_id:
            continue
        item = items.get(r.get("item_id") or "")
        spec = specs.get(r.get("spec_id") or (item.spec_id if item else ""))
        name = r.get("spec_name") if isinstance(r.get("spec_name"), dict) else None
        out[pax_id] = _assigned(item, spec, str(r.get("rung") or "onboard_spare"), name)
    return out


# ---------------------------------------------------------------- the block

def _taps(session: Session, flight_id: str) -> list[dict[str, Any]]:
    rows = session.exec(
        select(CrewEventLog).where(CrewEventLog.flight_id == flight_id, CrewEventLog.type.in_(TAP_TYPES))  # type: ignore[attr-defined]
    ).all()
    keep = ("client_id", "type", "passenger_id", "seat", "item_id", "at")
    return [{k: r.payload.get(k) for k in keep} for r in sorted(rows, key=lambda r: r.at)]


def _serve_key(seat: dict[str, Any], cabin: str) -> tuple[int, int, int, str]:
    """Business first, then economy front to back; within a row, the strictest passengers first."""
    return (0 if cabin == "C" else 1, _row(seat["seat"]), TIER_RANK.get(seat["tier"], 9), seat["seat"])


def _trays(items: list[MealItem], specs: dict[str, MealSpec], router: list[dict[str, Any]] | None,
           by_seat: dict[str, Passenger]) -> dict[str, dict[str, Any]]:
    """The tray per passenger: the router's plan where it has one, else the meal items."""
    trays = {
        pid: _assigned(item, specs.get(item.spec_id), RUNG_BY_KIND.get(item.kind, "onboard_spare"))
        for pid, item in _core_trays(items).items()
    }
    if not router:
        return trays
    planned = _router_trays(router, by_seat, {i.id: i for i in items}, specs)
    taken = {a["item_id"] for a in planned.values() if a["item_id"]}
    return {**{pid: a for pid, a in trays.items() if pid in planned or a["item_id"] not in taken}, **planned}


def _seat(session: Session, flight: Flight, pax: Passenger, info: dict[str, Any] | None,
          sun_row: dict[str, Any] | None, tray: dict[str, Any] | None) -> dict[str, Any]:
    """One seat of the block; `main_pick` is popped again once mains are held."""
    try:
        rules = _rules_today(info["rules"], flight.date) if info else None
        plan = passport.plan_for(session, pax, info["rules"]) if info else None
        card = passport.rules_card(rules)
    except (KeyError, ValueError):  # a tag the rules engine doesn't know: show the seat, not the rules
        log.exception("m20: can't read the rules of %s on %s", pax.id, flight.id)
        info, rules, plan, card = None, None, None, passport.rules_card(None)
    seat = {
        "seat": pax.seat,
        "passenger_id": pax.id,
        "tier": passport.strictest(rules),
        "flex": bool(info and info["rules"].get("flex")),
        "card": card,
        "may_eat_from": sun_row["may_eat_from"] if sun_row else None,
        "sunrise_box": bool(sun_row and sun_row["sunrise_box"]),
        "assigned": tray,
        "any_main": bool(plan and plan["any_main"]),
        "main_pick": plan["main_pick"] if plan else None,
    }
    # Extras only when they say something, so the package stays small.
    extras = {
        "source": info["source"] if info else None,
        "fast_today": bool(rules and rules["time_rules_active"]),
        "sun_rule": _sun_kind(rules) if rules else None,
        "may_eat_until": sun_row["may_eat_until"] if sun_row else None,
        "sun_note": sun_row["sun_note"] if sun_row else None,
    }
    return {**seat, **{k: v for k, v in extras.items() if v}}


def _hold_mains(rows: list[tuple[dict[str, Any], Passenger]], free_mains: list[MealItem],
                specs: dict[str, MealSpec]) -> None:
    """Hold a main for whoever has exactly one main that fits: strictest first, their own galley first."""
    for seat, pax in sorted(rows, key=lambda sp: _serve_key(sp[0], sp[1].cabin)):
        pick = seat.pop("main_pick")
        if seat["assigned"] or not pick or seat["any_main"]:
            continue
        home = galley_for(pax.seat)
        main = next((i for i in free_mains if i.spec_id == pick and i.galley == home), None) or next(
            (i for i in free_mains if i.spec_id == pick), None)
        if main:
            free_mains.remove(main)
            seat["assigned"] = _assigned(main, specs.get(main.spec_id), "held_main")


STRICTNESS = {"none": 0, "soft": 1, "firm": 2, "hard": 3}


def build_copilot(session: Session, flight: Flight, passengers: list[Passenger], items: list[MealItem],
                  specs: dict[str, MealSpec], booked: dict[str, dict[str, Any]]) -> dict[str, Any]:
    known = _known_rules(session, flight, passengers, booked)
    sun = _sun_rows(session, flight.id)
    router = _router_rows(session, flight.id)
    trays = _trays(items, specs, router, {p.seat: p for p in passengers})
    in_use = {a["item_id"] for a in trays.values() if a["item_id"]}
    free_mains = sorted((i for i in items if i.kind == "main" and not i.assigned_passenger_id
                         and i.status in OPEN_STATUSES and i.id not in in_use), key=lambda i: i.position)

    rows = [
        (_seat(session, flight, pax, known.get(pax.id), (sun or {}).get(pax.id), trays.get(pax.id)), pax)
        for pax in passengers
        # told us nothing, no tray, no sun rule: "not stated" on the map
        if pax.id in known or pax.id in trays or pax.id in (sun or {})
    ]
    # A late change the router handled can be stricter than what the passport knows (or the passport may not exist).
    by_seat = {p.seat: p for p in passengers}
    router_tier = {(r.get("passenger_id") or getattr(by_seat.get(r.get("seat") or ""), "id", None)): r.get("tier")
                   for r in router or []}
    for seat, pax in rows:
        tier = router_tier.get(pax.id)
        if tier in STRICTNESS and STRICTNESS[tier] > STRICTNESS.get(seat["tier"], 0):
            seat["tier"] = tier
    _hold_mains(rows, free_mains, specs)

    item_by_id = {i.id: i for i in items}
    seats = []
    for seat, pax in rows:
        tray = item_by_id.get((seat["assigned"] or {}).get("item_id") or "")
        seat["galley"] = tray.galley if tray else galley_for(pax.seat)
        if not seat["assigned"] and seat["tier"] in ("hard", "firm") and not seat["any_main"] and not seat["sunrise_box"]:
            seat["needs_tray"] = True  # strict or medical, no main fits and no tray held: crew must find one
        seats.append(seat)

    cabin_of = {p.seat: p.cabin for p in passengers}
    to_serve = [s for s in seats if s["assigned"] or s.get("needs_tray") or s.get("sun_rule") or s["may_eat_from"]
                or s["sunrise_box"]]
    serve_order = [s["seat"] for s in sorted(to_serve, key=lambda s: _serve_key(s, cabin_of[s["seat"]]))]
    return {
        "seats": sorted(seats, key=lambda s: _serve_key(s, cabin_of[s["seat"]])),
        "serve_order": serve_order,
        "taps": _taps(session, flight.id),
        "sources": {"trays": "m18" if router else "meal items", "sun": "m21" if sun is not None else None},
    }
