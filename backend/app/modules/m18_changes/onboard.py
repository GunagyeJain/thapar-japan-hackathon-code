"""The last rungs on board: flex swap, Sunrise Box, the honest "not met", and what a no-show frees."""
import logging
from typing import Any

from sqlmodel import select

from app.core.ids import new_id
from app.core.models import MealItem, MealSpec, Passenger
from app.modules.m6_matcher.inventory import menu_cabin
from app.modules.m6_matcher.matcher import VOUCHER
from app.modules.m17_passport import service as passport
from app.modules.m18_changes import kitchen, windows
from app.modules.m18_changes.context import (
    USABLE, Ctx, day_rules, display_name, fired_text, fits, galley_for, held_items, no_show_ids, passenger_lang,
    row_of, service_key, spec_of,
)
from app.modules.m18_changes.models import NoShow
from app.modules.m18_changes.rungs import Choice, Skip
from app.modules.m18_changes.texts import txt

log = logging.getLogger(__name__)


# ---------------------------------------------------------------- flex swap


def _free_mains(ctx: Ctx, cabin: str) -> dict[str, list[MealItem]]:
    """Main-course items nobody holds, by spec, for one cabin's menu."""
    rows = ctx.session.exec(select(MealItem).where(MealItem.flight_id == ctx.flight.id, MealItem.kind == "main")).all()
    out: dict[str, list[MealItem]] = {}
    for item in sorted(rows, key=lambda i: i.position):
        if item.assigned_passenger_id is None and item.status in USABLE and menu_cabin(item.spec_id) == cabin:
            out.setdefault(item.spec_id, []).append(item)
    return out


def _nearest(items: list[MealItem], seat: str) -> MealItem | None:
    """Prefer the galley that serves this seat."""
    return next((i for i in items if i.galley == galley_for(seat)), items[0] if items else None)


def _flex_people(ctx: Ctx) -> list[tuple[Passenger, dict[str, Any]]]:
    """Passengers who opted into flex and could still change: same cabin, on board, holding nothing yet.

    A run-out names the trolley's rows: only those served before the requester count (they would take the dish).
    Passengers without allergies first, then nearest.
    """
    me = ctx.passenger
    gone = no_show_ids(ctx.session, ctx.flight.id)
    out = []
    for p in ctx.session.exec(select(Passenger).where(Passenger.flight_id == ctx.flight.id, Passenger.cabin == me.cabin)).all():
        if p.id == me.id or p.id in gone or held_items(ctx.session, p.id):
            continue
        if ctx.rows and not (ctx.rows[0] <= row_of(p.seat) <= ctx.rows[1] and service_key(p) < service_key(me)):
            continue
        rules = passport.rules_for(ctx.session, p.id)
        if rules and rules.get("flex"):
            out.append((p, rules))
    return sorted(out, key=lambda pr: (bool(pr[1].get("allergens")), abs(row_of(pr[0].seat) - row_of(me.seat)),
                                       service_key(pr[0])))


def plan_flex_swap(ctx: Ctx) -> Choice | Skip:
    me = ctx.passenger
    if me is None:
        return Skip("flex_swap", txt("skip.flex_none"))
    free = _free_mains(ctx, me.cabin)
    specs = {s.id: s for s in ctx.session.exec(select(MealSpec).where(MealSpec.kind == "main")).all()
             if menu_cabin(s.id) == me.cabin}
    suits = [s for s in specs.values() if fits(s, ctx.strict)]
    if not suits:
        worst = next(iter(sorted(specs.values(), key=lambda s: s.id)), None)
        return Skip("flex_swap", txt("skip.flex_no_main", fired=fired_text(worst, ctx.strict) if worst else "—"))
    for spec in sorted(suits, key=lambda s: s.id):
        mine = _nearest(free.get(spec.id, []), me.seat)
        if mine is None:
            continue
        for flex, rules in _flex_people(ctx):
            _, _, strict = day_rules(rules, ctx.flight)
            alts = [s for s in specs.values() if s.id != spec.id and fits(s, strict) and free.get(s.id)]
            if alts:
                return _swap(ctx, spec, mine, flex, alts[0], _nearest(free[alts[0].id], flex.seat))
    return Skip("flex_swap", txt("skip.flex_none"))


def _swap(ctx: Ctx, spec: MealSpec, mine: MealItem, flex: Passenger, alt: MealSpec, theirs: MealItem) -> Choice:
    me, miles = ctx.passenger, windows.FLEX_MILES
    values = {"flex_seat": flex.seat, "alt": alt.name, "miles": miles, "seat": me.seat, "spec": spec.name,
              "item": mine.id, "galley": mine.galley[-1], "mark": ctx.mark}
    swap = {"passenger_id": flex.id, "seat": flex.seat, "name": display_name(flex), "item_id": theirs.id,
            "spec_id": alt.id, "spec_name": alt.name, "miles": miles}

    def apply() -> MealItem:
        mine.assigned_passenger_id, theirs.assigned_passenger_id = me.id, flex.id
        ctx.session.add_all([mine, theirs])
        lang = passenger_lang(ctx.session, flex, None)
        title = {"en": f"Thank you: +{miles} miles", "hi": f"धन्यवाद: +{miles} मील", "ja": f"ありがとうございます：+{miles}マイル"}
        kitchen.tell_passenger(ctx.session, flex, txt("msg.flex_giver", alt=alt.name, miles=miles), lang,
                               ctx.change_id, title)
        body = (f"{kitchen.pax_line(me)}: serve {mine.id} ({spec.name['en']}). {kitchen.pax_line(flex)} opted into flex: "
                f"serve {theirs.id} ({alt.name['en']}), +{miles} miles.")
        kitchen.tell_crew(ctx, f"Flex swap: {me.seat} and {flex.seat}", body, item_id=mine.id, swap_item_id=theirs.id)
        kitchen.late_checkpoint(ctx, "flex_swap", mine, body)
        return mine

    return Choice("flex_swap", txt("why.flex_swap", **values), item=mine, spec=spec,
                  message=txt("msg.flex_requester", spec=spec.name, mark=ctx.mark), apply=apply, extra={"swap": swap})


# ---------------------------------------------------------------- Sunrise Box


def _eat_window(ctx: Ctx, rule: dict[str, Any]) -> dict[str, Any] | None:
    """m21's eating window for one daylight rule on this flight, or None when m21 isn't there."""
    try:
        from app.modules.m21_sun import service as sun

        dep, arr = sun.flight_times(ctx.flight)
        events = sun.sun_events(ctx.flight.origin, ctx.flight.dest, dep, arr)
        try:
            return sun.eat_window(events, rule)
        except ValueError:  # m21 names the dawn-to-sunset fast differently
            return sun.eat_window(events, {**rule, "kind": "fast_dawn_to_sunset"})
    except (ImportError, AttributeError, ValueError, TypeError) as exc:
        log.info("m18: sun times not available (%s)", exc)
        return None


def plan_sunrise_box(ctx: Ctx) -> Choice | Skip:
    rules = [r for r in ctx.rules.get("time_rules", []) if r.get("kind") in ("daylight", "dawn_to_sunset")]
    if not rules:
        return Skip("sunrise_box", txt("skip.sun_no_rule"))
    window = _eat_window(ctx, rules[0])
    if window is None:
        return Skip("sunrise_box", txt("skip.sun_unknown"))
    if not window.get("sunrise_box"):
        start = window.get("may_eat_from")
        return Skip("sunrise_box", txt("skip.sun_can_eat", time=windows.hhmm(start) if start else "—"))

    def apply() -> None:
        kitchen.tell_crew(ctx, f"{ctx.passenger.seat}: Sunrise Box",
                          f"{kitchen.pax_line(ctx.passenger)}: no time to eat on board under their daylight rule; hand a sealed box.")

    return Choice("sunrise_box", txt("why.sunrise_box"), message=txt("msg.sunrise_box", mark=ctx.mark),
                  apply=apply if ctx.passenger else None)


# ---------------------------------------------------------------- not met, told honestly


def plan_unmet(ctx: Ctx) -> Choice:
    on_ground = ctx.window in windows.BEFORE_BOARDING
    extra: dict[str, Any] = {}
    if on_ground:
        code = new_id("VCH", 6)
        extra["voucher"] = {"code": code, "value_inr": VOUCHER["value_inr"], "outlets": VOUCHER["outlets"]}
        message = txt("msg.unmet_voucher", mark=ctx.mark, voucher=code)
    else:
        message = txt("msg.unmet_inflight", mark=ctx.mark)

    def apply() -> None:
        what = f"voucher {extra['voucher']['code']} (₹600) issued" if on_ground else "tell them honestly, offer only what is safe"
        kitchen.tell_crew(ctx, f"{ctx.passenger.seat}: nothing on board fits",
                          f"{kitchen.pax_line(ctx.passenger)}: {ctx.mark['en']}. No safe meal is left; {what}.")
        kitchen.late_checkpoint(ctx, "unmet", None, f"No safe meal still possible: {ctx.mark['en']}")

    return Choice("unmet", txt("why.unmet_voucher" if on_ground else "why.unmet_inflight"), message=message,
                  apply=apply if ctx.passenger else None, extra=extra)


# ---------------------------------------------------------------- a no-show


def no_show(ctx: Ctx) -> Choice:
    """The passenger didn't board: everything held for them is freed; their special meal goes to the next request."""
    p = ctx.passenger
    held = held_items(ctx.session, p.id)
    item = next((i for i in held if i.kind == "special"), held[0] if held else None)
    spec = spec_of(ctx.session, item)
    already = ctx.session.exec(select(NoShow).where(NoShow.passenger_id == p.id)).first()

    def apply() -> MealItem | None:
        if already is None:
            ctx.session.add(NoShow(id=new_id("NS"), flight_id=ctx.flight.id, passenger_id=p.id, at=ctx.at,
                                   released_item_id=item.id if item else None))
        for i in held:
            i.assigned_passenger_id = None
            ctx.session.add(i)
        what = f"{item.id} ({spec.name['en']}) in galley {item.galley[-1]} is free for another passenger" if item else "nothing was held"
        kitchen.tell_crew(ctx, f"{p.seat}: did not board", f"{kitchen.pax_line(p)} did not board: {what}.",
                          item_id=item.id if item else None)
        return item

    if item is None:
        return Choice("noshow_release", txt("why.no_show_empty", seat=p.seat), apply=apply)
    values = {"seat": p.seat, "spec": spec.name, "item": item.id, "galley": item.galley[-1]}
    return Choice("noshow_release", txt("why.no_show", **values), item=item, spec=spec, code=spec.code, apply=apply)
