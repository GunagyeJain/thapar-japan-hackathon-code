"""Read side of m18: the change log with its windows, the metrics against today's process, and the onboard plan."""
from typing import Any

from sqlmodel import Session, select

from app.core import clock
from app.core.models import Flight, MealItem, MealSpec, Passenger, Profile
from app.modules.m7_caterer.models import MealListVersion
from app.modules.m17_passport import service as passport
from app.modules.m17_passport.models import Passport
from app.modules.m18_changes import today as today_process, windows
from app.modules.m18_changes.context import USABLE, display_name, galley_for, no_show_ids, service_key
from app.modules.m18_changes.models import ChangeEvent, NoShow

DEFAULT_RUNG = {"special": "ssr_change", "spare": "onboard_spare", "main": "onboard_spare", "backup": "reserve_pouch"}


def event_payload(event: ChangeEvent) -> dict[str, Any]:
    return {**event.model_dump(exclude={"chaos_key"}), "chaos": event.chaos_key is not None}


def events_of(session: Session, flight_id: str) -> list[ChangeEvent]:
    return list(session.exec(select(ChangeEvent).where(ChangeEvent.flight_id == flight_id).order_by(ChangeEvent.seq)).all())


def list_changes(session: Session, flight: Flight) -> dict[str, Any]:
    now = clock.now(session=session)
    return {"now": now, "window": windows.window_at(flight, now), "windows": windows.milestones(flight),
            "long_lead": windows.long_lead_cutoff(flight), "events": [event_payload(e) for e in events_of(session, flight.id)]}


# ---------------------------------------------------------------- metrics


def _counts(events: list[ChangeEvent], met) -> dict[str, int]:
    hard = [e for e in events if e.request.get("tier") == "hard"]
    firm = [e for e in events if e.request.get("tier") == "firm"]
    return {"events": len(events), "hard_total": len(hard), "hard_met": sum(1 for e in hard if met(e)),
            "firm_total": len(firm), "firm_met": sum(1 for e in firm if met(e))}


def ours_wasted(session: Session, flight_id: str) -> int:
    """Fresh meals left over if the flight ended now: spare special meals nobody holds, and no-show meals not
    passed on. Universal-plate pouches fly again, so they never count."""
    spares = [i for i, _ in today_process.special_spares(session, flight_id)
              if i.assigned_passenger_id is None and i.status in USABLE]
    freed = 0
    for ns in session.exec(select(NoShow).where(NoShow.flight_id == flight_id)).all():
        item = session.get(MealItem, ns.released_item_id) if ns.released_item_id else None
        freed += bool(item and item.assigned_passenger_id is None)
    return len(spares) + freed


def known_before_cutoff(session: Session, flight: Flight) -> tuple[int, int, int]:
    """(ours, today, passengers). Today: special-meal requests on the list cut at the cutoff.
    Ours: passengers with a passport or a profile from before the cutoff (m17)."""
    cutoff = flight.special_meal_cutoff
    pax = session.exec(select(Passenger).where(Passenger.flight_id == flight.id)).all()
    ids = {p.id for p in pax}
    passports = {pp.passenger_id: pp for pp in session.exec(select(Passport)).all() if pp.passenger_id in ids}
    profiles = {pf.passenger_id: pf for pf in session.exec(select(Profile)).all() if pf.passenger_id in ids}
    ours = 0
    for pid in ids:
        record = passports.get(pid) or profiles.get(pid)
        when = getattr(record, "updated_at", None) or getattr(record, "created_at", None)
        ours += bool(when and when <= cutoff)
    lists = session.exec(select(MealListVersion).where(MealListVersion.flight_id == flight.id)).all()
    at_cutoff = [v for v in lists if v.created_at <= cutoff]
    today = len(max(at_cutoff, key=lambda v: v.version).lines) if at_cutoff else sum(1 for p in pax if p.ssr_meal)
    return ours, today, len(pax)


def metrics(session: Session, flight: Flight) -> dict[str, Any]:
    events = events_of(session, flight.id)
    known_ours, known_today, total = known_before_cutoff(session, flight)
    ours = {**_counts(events, lambda e: e.decision.get("ok")), "meals_wasted": ours_wasted(session, flight.id),
            "known_before_cutoff": known_ours, "passengers": total}
    today = {**_counts(events, lambda e: e.today.get("ok")), "meals_wasted": today_process.wasted(session, flight.id),
             "known_before_cutoff": known_today, "passengers": total}
    return {"ours": ours, "today": today}


# ---------------------------------------------------------------- the onboard plan


def _rungs_and_tiers(events: list[ChangeEvent]) -> tuple[dict[str, str], dict[str, str]]:
    rung_of, tier_of = {}, {}
    for e in events:
        d = e.decision
        if d.get("item_id"):
            rung_of[d["item_id"]] = d["rung"]
        for extra in d.get("also", []):
            if extra.get("item_id"):
                rung_of[extra["item_id"]] = extra["rung"]
            tier_of[extra["passenger_id"]] = extra.get("tier")
        if d.get("swap"):
            rung_of[d["swap"]["item_id"]] = "flex_swap"
        if e.passenger_id and e.kind != "no_show":
            tier_of[e.passenger_id] = e.request.get("tier")
    return rung_of, tier_of


def _take(free: dict[str, list[MealItem]], spec_id: str, seat: str) -> MealItem | None:
    items = free.get(spec_id) or []
    item = next((i for i in items if i.galley == galley_for(seat)), items[0] if items else None)
    if item:
        items.remove(item)
    return item


def _row(p: Passenger, item: MealItem, spec: MealSpec | None, rung: str | None, tier: str, source: str) -> dict[str, Any]:
    return {"seat": p.seat, "passenger_id": p.id, "name": display_name(p), "item_id": item.id,
            "spec_id": item.spec_id, "spec_name": spec.name if spec else None, "code": spec.code if spec else None,
            "kind": item.kind, "galley": item.galley, "position": item.position, "rung": rung, "tier": tier,
            "source": source}


def assignments(session: Session, flight_id: str) -> list[dict[str, Any]]:
    """Every tray with a seat on it, in service order (business first, then economy front to back): the meals
    assigned to a passenger, plus the main course held for each passenger whose passport plan picks one."""
    gone = no_show_ids(session, flight_id)
    pax = sorted((p for p in session.exec(select(Passenger).where(Passenger.flight_id == flight_id)).all()
                  if p.id not in gone), key=service_key)
    items = session.exec(select(MealItem).where(MealItem.flight_id == flight_id)).all()
    specs = {s.id: s for s in session.exec(select(MealSpec)).all()}
    held: dict[str, list[MealItem]] = {}
    free_mains: dict[str, list[MealItem]] = {}
    for item in sorted(items, key=lambda i: i.position):
        if item.status not in USABLE:
            continue
        if item.assigned_passenger_id:
            held.setdefault(item.assigned_passenger_id, []).append(item)
        elif item.kind == "main":
            free_mains.setdefault(item.spec_id, []).append(item)
    rung_of, tier_of = _rungs_and_tiers(events_of(session, flight_id))
    out = []
    for p in pax:
        rules = passport.rules_for(session, p.id)
        tier = tier_of.get(p.id) or passport.strictest(rules)
        for item in held.get(p.id, []):
            out.append(_row(p, item, specs.get(item.spec_id), rung_of.get(item.id) or DEFAULT_RUNG.get(item.kind), tier,
                            "assigned"))
        if p.id in held or not rules:
            continue
        pick = passport.plan_for(session, p, rules).get("main_pick")
        item = _take(free_mains, pick, p.seat) if pick else None
        if item:
            out.append(_row(p, item, specs.get(item.spec_id), None, tier, "main_pick"))
    return [{**row, "order": n} for n, row in enumerate(out, start=1)]
