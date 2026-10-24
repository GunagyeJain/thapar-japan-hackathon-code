"""Writes the router makes on other modules' rows, through their own functions: the promise (m3), the booking's
meal request (m4's feed), the meal item the caterer loads, and the crew/caterer/LATE records."""
import logging
from typing import Any

from sqlmodel import Session, select

from app.core import clock, events, outbox
from app.core.ids import new_id
from app.core.models import Alert, Flight, MealItem, MealPromise, MealSpec, Passenger
from app.modules.m18_changes.context import Ctx, fits, galley_for, held_items, spec_of

log = logging.getLogger(__name__)

SOURCE = "change_router"
CONSENT = {"this_trip": True, "save_profile": False, "share_with_caterer": True, "cross_border_ack": True}
# Recipes the caterer's standby bank needs that the seed doesn't have. Tags the rules engine reads.
EXTRA_SPECS: dict[str, dict[str, Any]] = {
    "DBML": {
        "id": "SPEC-DBML",
        "name": {"en": "Diabetic meal: paneer tikka, jeera rice, cucumber-tomato salad (no added sugar)",
                 "hi": "मधुमेह भोजन: पनीर टिक्का, जीरा राइस, खीरा-टमाटर सलाद (बिना चीनी)",
                 "ja": "低糖質のお食事：パニールティッカ、ジーラライス、きゅうりとトマトのサラダ（砂糖不使用）"},
        "code": "DBML", "kind": "special", "tags": ["paneer", "rice", "cucumber", "tomato", "cumin"],
        "certified": False, "source": "caterer",
    },
}


def crew_to(flight: Flight) -> str:
    return f"crew:{flight.flight_no}"


def promise_of(session: Session, passenger_id: str) -> MealPromise | None:
    return session.exec(select(MealPromise).where(MealPromise.passenger_id == passenger_id)).first()


def specs_for_code(session: Session, code: str) -> list[MealSpec]:
    specs = session.exec(select(MealSpec).where(MealSpec.code == code, MealSpec.kind == "special")).all()
    if not specs and code in EXTRA_SPECS:
        specs = [ensure_spec(session, code)]
    return sorted(specs, key=lambda s: s.id)


def ensure_spec(session: Session, code: str) -> MealSpec:
    data = EXTRA_SPECS[code]
    spec = session.get(MealSpec, data["id"])
    if spec is None:
        spec = MealSpec(**data)
        session.add(spec)
        session.flush()
    return spec


def spec_for(ctx: Ctx, code: str) -> MealSpec | None:
    """The caterer's recipe for this code that fits: every rule if one does, else every hard and firm rule."""
    specs = specs_for_code(ctx.session, code)
    best = [s for s in specs if fits(s, ctx.day["forbid"])] or [s for s in specs if fits(s, ctx.strict)]
    return best[0] if best else None


def _new_item_id(session: Session) -> str:
    while True:
        item_id = new_id("TB", 6)
        if session.get(MealItem, item_id) is None:
            return item_id


def _next_position(session: Session, flight_id: str, galley: str, letter: str) -> str:
    prefix = f"{galley}-{letter}"
    taken = session.exec(select(MealItem.position).where(MealItem.flight_id == flight_id)).all()
    nums = [int(p[len(prefix):]) for p in taken if p.startswith(prefix) and p[len(prefix):].isdigit()]
    return f"{prefix}{max(nums, default=0) + 1:02d}"


def new_item(ctx: Ctx, spec: MealSpec, *, galley: str, letter: str) -> MealItem:
    """A meal the caterer will load for this passenger (kind special)."""
    item = MealItem(id=_new_item_id(ctx.session), flight_id=ctx.flight.id, spec_id=spec.id, kind="special",
                    galley=galley, position=_next_position(ctx.session, ctx.flight.id, galley, letter),
                    assigned_passenger_id=ctx.passenger.id, status="planned")
    ctx.session.add(item)
    ctx.session.flush()
    return item


def ensure_special(ctx: Ctx, spec: MealSpec | None) -> MealItem | None:
    """The special meal the kitchen makes for this booking: the one already held (re-specced if it no longer
    fits; nothing is cooked before the final list), or a new one."""
    held = [i for i in held_items(ctx.session, ctx.passenger.id) if i.kind == "special"]
    if held:
        item = held[0]
        if spec is not None and item.spec_id != spec.id and not fits(spec_of(ctx.session, item), ctx.strict):
            item.spec_id = spec.id
            ctx.session.add(item)
        return item
    return new_item(ctx, spec, galley=galley_for(ctx.passenger.seat), letter="S") if spec else None


def save_promise(ctx: Ctx, option: dict[str, Any]) -> MealPromise:
    """Profile + promise + C1 through m3's own save, as the passenger form does."""
    from app.modules.m3_passenger.router import _save

    rules = ctx.rules
    fasting = [d for r in rules.get("time_rules", []) if r.get("kind") == "dates" and r.get("preset") == "vrat"
               for d in r.get("dates", [])]
    base_forbid = [t for t in rules.get("forbid", []) if t not in (rules.get("allergens") or [])]
    _, promise = _save(ctx.session, ctx.passenger, lang=ctx.lang, forbid=base_forbid, allow=rules.get("allow", []),
                       consent={**CONSENT, "at": ctx.at.isoformat()}, option=option, source=SOURCE,
                       fasting_dates=fasting, allergens=rules.get("allergens") or [])
    return promise


def book_ssr(ctx: Ctx, code: str, note: str | None) -> None:
    """Put the meal request on the booking: staff key in the SSR and the ADL comes back through m4's feed."""
    from app.modules.m4_watcher.watcher import simulate

    try:
        simulate("restore_meal", ctx.passenger.id, session=ctx.session, code=code, note=note)
    except ValueError as exc:  # e.g. a note the ADL format can't carry: write the booking directly instead
        log.warning("m18: ADL for %s %s failed (%s); setting the booking directly", ctx.passenger.id, code, exc)
        ctx.passenger.ssr_meal, ctx.passenger.ssr_note = code, note
        ctx.session.add(ctx.passenger)


def open_lost_meal(session: Session, passenger_id: str) -> Alert | None:
    return session.exec(select(Alert).where(Alert.type == "LOST_MEAL", Alert.passenger_id == passenger_id,
                                            Alert.status != "resolved")).first()


def request_again(ctx: Ctx, alert: Alert) -> None:
    """m4's "request again": draft the SSR, the corrected ADL comes back through the feed, which resolves the
    alert, writes C2 fixed and tells the passenger. Same steps as m4's alert action, inside this transaction."""
    from app.modules.m4_watcher.watcher import simulate, ssr_draft

    p, flight, ev = ctx.passenger, ctx.flight, alert.evidence or {}
    promise = ctx.session.get(MealPromise, alert.promise_id) if alert.promise_id else promise_of(ctx.session, p.id)
    code = ev.get("code_before") or (promise.code if promise else None)
    note = ev.get("note_before") or (promise.kitchen_note if promise else None)
    now = clock.now(session=ctx.session).isoformat()
    alert.actions = [*alert.actions, {"action": "request_again", "actor": "ThaliBento change router", "at": now,
                                      "note": f"Change {ctx.change_id}: caterer_add"}]
    alert.evidence = {**ev, "ssr_draft": ssr_draft(flight, p, code, note)}
    ctx.session.add(alert)
    simulate("restore_meal", p.id, session=ctx.session, code=code, note=note)


def late_checkpoint(ctx: Ctx, rung: str, item: MealItem | None, detail: str) -> None:
    """LATE on the passenger's record (as m6 writes for a late request), so the timeline shows the change."""
    promise = promise_of(ctx.session, ctx.passenger.id)
    events.record_checkpoint(promise.id if promise else None, ctx.passenger.id, ctx.flight.id, "LATE",
                             "ok" if item else "info", source=f"m18:{rung}", detail=detail,
                             data={"change_id": ctx.change_id, "rung": rung, "item_id": item.id if item else None},
                             key=f"m18:{ctx.change_id}:{ctx.passenger.id}", session=ctx.session)


def tell_crew(ctx: Ctx, title: str, body: str, **ref: Any) -> None:
    outbox.notify("crew", crew_to(ctx.flight), title, body, ref={"kind": "change", "change_id": ctx.change_id, **ref},
                  session=ctx.session)


def tell_caterer(ctx: Ctx, title: str, body: str, **ref: Any) -> None:
    outbox.notify("caterer", "caterer", title, body, ref={"kind": "change", "change_id": ctx.change_id, **ref},
                  session=ctx.session)


def tell_passenger(session: Session, passenger: Passenger, text: dict[str, str], lang: str, change_id: str,
                   title: dict[str, str]) -> None:
    outbox.notify("whatsapp", passenger.id, title.get(lang) or title["en"], text.get(lang) or text["en"], lang=lang,
                  ref={"kind": "change", "change_id": change_id, "text": text}, session=session)


def pax_line(p: Passenger) -> str:
    return f"{p.seat} {p.surname}/{p.given}"
