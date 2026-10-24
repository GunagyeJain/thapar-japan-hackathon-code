"""What today's process does with the same event, by the rules of today's operation:

- before the cutoff a proper request works;
- after it there is no channel: the passenger can only ask the crew, who can hand over a spare special meal whose
  code matches the diet they state, without any rules check;
- a request the airline's own systems drop goes unnoticed;
- a no-show's special meal is thrown away; fresh spares left at the end are thrown away too;
- a run-out leaves the last vegetarians without a main; a fast found on board is not met.
"""
from typing import Any

from sqlmodel import Session, select

from app.core.models import MealItem, MealSpec
from app.modules.m1_rules import engine
from app.modules.m18_changes import windows
from app.modules.m18_changes.context import Ctx, fired_text, fits, held_items, spec_of
from app.modules.m18_changes.models import ChangeEvent
from app.modules.m18_changes.texts import txt

NO_CHANNEL = {"chat": "today.no_channel", "radar": "today.no_channel", "checkin": "today.too_late",
              "lounge": "today.lounge"}


def special_spares(session: Session, flight_id: str) -> list[tuple[MealItem, MealSpec]]:
    """Fresh spare special meals loaded for the flight (a special-meal code, not the business menu's extras)."""
    items = session.exec(select(MealItem).where(MealItem.flight_id == flight_id, MealItem.kind == "spare")).all()
    pairs = [(i, session.get(MealSpec, i.spec_id)) for i in sorted(items, key=lambda i: i.position)]
    return [(i, s) for i, s in pairs if s is not None and s.code]


def used_today(session: Session, flight_id: str) -> set[str]:
    """Spares today's crew already handed out earlier in this log."""
    rows = session.exec(select(ChangeEvent).where(ChangeEvent.flight_id == flight_id)).all()
    return {e.today["item_id"] for e in rows if (e.today or {}).get("item_id")}


def stated_code(ctx: Ctx) -> str | None:
    """The code a crew member would look for when the passenger names their diet: the closest code that needs no
    kitchen note. A fast has no meal code."""
    options = engine.code_options(ctx.day["forbid"], ctx.day["allow"])
    exact = [o for o in options if not o["safety_gaps"]]
    return (exact or options)[0]["code"] if options else None


def is_fast(ctx: Ctx) -> bool:
    return bool(ctx.day.get("time_rules_active")) or "grain" in ctx.day["forbid"]


def _out(ok: bool, key: str, item_id: str | None = None, wasted: int = 0, **values: Any) -> dict[str, Any]:
    return {"ok": ok, "outcome": txt(key, **values), "item_id": item_id, "wasted": wasted}


def today_for(ctx: Ctx, run_out_seats: str | None = None) -> dict[str, Any]:
    """Call before the router writes anything (a no-show's meal is still held then)."""
    if ctx.kind == "no_show":
        held = [i for i in held_items(ctx.session, ctx.passenger.id) if i.kind == "special"] if ctx.passenger else []
        spec = spec_of(ctx.session, held[0]) if held else None
        if spec is None:
            return _out(True, "today.nothing_held")
        return _out(False, "today.thrown", wasted=1, code=spec.code or spec.name["en"])
    if ctx.window == "ssr":
        return _out(True, "today.before_cutoff")
    if windows.closed_early(ctx.flight, ctx.at, ctx.long_lead):
        return _out(False, "today.long_lead")
    if ctx.kind == "lost_request" or ctx.channel == "feed":
        return _out(False, "today.lost")
    if ctx.kind == "run_out":
        return _out(False, "today.run_out", seats=run_out_seats or ctx.seat)
    if not ctx.day["forbid"]:
        return _out(True, "today.no_rules")
    if ctx.channel in NO_CHANNEL:
        return _out(False, NO_CHANNEL[ctx.channel])
    if is_fast(ctx):
        return _out(False, "today.fast")
    code = stated_code(ctx)
    used = used_today(ctx.session, ctx.flight.id)
    spare = next(((i, s) for i, s in special_spares(ctx.session, ctx.flight.id) if s.code == code and i.id not in used), None)
    if spare is None:
        return _out(False, "today.no_spare", code=code or "—")
    item, spec = spare
    if fits(spec, ctx.strict):
        return _out(True, "today.luck", item_id=item.id, code=code)
    return _out(False, "today.unchecked_unsafe", item_id=item.id, code=code, fired=fired_text(spec, ctx.strict))


def wasted(session: Session, flight_id: str) -> int:
    """Today's process: no-show meals thrown away, plus fresh spares nobody was handed by the end."""
    rows = session.exec(select(ChangeEvent).where(ChangeEvent.flight_id == flight_id)).all()
    thrown = sum((e.today or {}).get("wasted", 0) for e in rows)
    used = used_today(session, flight_id)
    return thrown + sum(1 for i, _ in special_spares(session, flight_id) if i.id not in used)
