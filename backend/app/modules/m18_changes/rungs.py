"""The ladder: one planner per rung. A planner looks (no writes) and returns a Choice, whose `apply` does the
writes, or a Skip with the plain-language reason. The router takes the first Choice for the window."""
from collections import Counter
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any

from sqlmodel import select

from app.core.models import MealItem, MealSpec, Passenger
from app.modules.m3_passenger.options import meal_options
from app.modules.m6_matcher import inventory, matcher
from app.modules.m18_changes import kitchen, windows
from app.modules.m18_changes.context import USABLE, Ctx, fired_text, fits, held_items, spec_of
from app.modules.m18_changes.models import ChangeEvent, NoShow
from app.modules.m18_changes.texts import Text, note_suffix, txt

M6_SOURCE = {"checkin": "checkin", "crew": "crew"}  # everything else is a desk at the airport ("gate")


@dataclass
class Choice:
    rung: str
    reason: Text
    item: MealItem | None = None
    spec: MealSpec | None = None
    code: str | None = None
    kitchen_note: str | None = None
    message: Text | None = None
    apply: Callable[[], MealItem | None] | None = None  # the writes; returns the item actually used
    extra: dict[str, Any] = field(default_factory=dict)


@dataclass
class Skip:
    rung: str
    reason: Text


def _where(item: MealItem) -> dict[str, str]:
    return {"item": item.id, "galley": item.galley[-1]}


# ---------------------------------------------------------------- before the trucks: the kitchen cooks it


def _book(ctx: Ctx, rung: str) -> Choice:
    f = ctx.flight
    lost = kitchen.open_lost_meal(ctx.session, ctx.passenger.id) if ctx.passenger and ctx.kind == "lost_request" else None
    if lost and lost.evidence.get("code_before"):
        code, note = lost.evidence["code_before"], lost.evidence.get("note_before")
        option = {"code": code, "kitchen_note": note, "label_mark": ctx.mark}
    else:
        option = meal_options(ctx.day["forbid"], ctx.day["allow"])[0]
        code, note = option["code"], option["kitchen_note"]
    spec = kitchen.spec_for(ctx, code)
    time = windows.hhmm(f.caterer_final_list_at)
    values = {"code": code, "note": note_suffix(note), "time": time, "mark": ctx.mark, "flight": f.flight_no}
    restored = ctx.kind == "lost_request" and (lost is not None or bool(ctx.passenger and ctx.passenger.ssr_meal))
    why = "why.caterer_add_lost" if restored else f"why.{rung}"
    msg = "msg.caterer_add_lost" if restored else f"msg.{rung}"

    def apply() -> MealItem | None:
        if not (restored and kitchen.promise_of(ctx.session, ctx.passenger.id)):
            kitchen.save_promise(ctx, option)
        if lost:
            kitchen.request_again(ctx, lost)
        elif not restored:
            kitchen.book_ssr(ctx, code, note)
        item = kitchen.ensure_special(ctx, spec)
        if rung == "caterer_add":
            kitchen.tell_caterer(ctx, f"{f.flight_no}: add {code} for {kitchen.pax_line(ctx.passenger)}",
                                 f"Late change after the cutoff: {code}{note_suffix(note)} goes on the final list at {time}"
                                 + (f" (item {item.id})." if item else "."), item_id=item.id if item else None)
        return item

    return Choice(rung, txt(why, **values), spec=spec, code=code, kitchen_note=note, message=txt(msg, **values),
                  apply=apply)


def plan_ssr_change(ctx: Ctx) -> Choice:
    return _book(ctx, "ssr_change")


def plan_caterer_add(ctx: Ctx) -> Choice:
    return _book(ctx, "caterer_add")


def stock_left(ctx: Ctx) -> dict[str, int]:
    cfg = windows.bank(ctx.flight) or {"stock": {}}
    done = ctx.session.exec(select(ChangeEvent).where(ChangeEvent.flight_id == ctx.flight.id)).all()
    used = Counter(e.decision.get("code") for e in done if e.decision.get("rung") == "standby_uplift")
    return {code: n - used[code] for code, n in cfg["stock"].items()}


def plan_standby_uplift(ctx: Ctx) -> Choice | Skip:
    cfg = windows.bank(ctx.flight)
    left = stock_left(ctx)
    stock = ", ".join(f"{c} ×{n}" for c, n in left.items()) or "—"
    for option in meal_options(ctx.day["forbid"], ctx.day["allow"]) if cfg else []:
        code = option["code"]
        spec = kitchen.spec_for(ctx, code) if left.get(code, 0) > 0 else None
        if spec is None or not fits(spec, ctx.strict):
            continue
        values = {"time": windows.hhmm(windows.dispatch(ctx.flight)), "code": code, "caterer": cfg["caterer"], "left": left[code] - 1,
                  "code_name": windows_code_name(code), "mark": ctx.mark, "flight": ctx.flight.flight_no, "galley": "2"}

        def apply(spec=spec, code=code, values=values) -> MealItem:
            item = kitchen.new_item(ctx, spec, galley="G2", letter="U")
            line = f"{kitchen.pax_line(ctx.passenger)}: 1 × {code} ({spec.name['en']}), item {item.id}, galley 2"
            kitchen.tell_caterer(ctx, f"{ctx.flight.flight_no}: standby uplift, 1 × {code}",
                                 f"{line}. On the truck before {values['time']}.", item_id=item.id)
            kitchen.tell_crew(ctx, f"{ctx.passenger.seat}: {code} from the standby stock", f"{line}.", item_id=item.id)
            kitchen.late_checkpoint(ctx, "standby_uplift", item, f"Standby uplift {code}: {line}")
            return item

        return Choice("standby_uplift", txt("why.standby_uplift", **values), spec=spec, code=code,
                      kitchen_note=option["kitchen_note"], message=txt("msg.standby_uplift", **values), apply=apply)
    return Skip("standby_uplift", txt("skip.standby_none", stock=stock))


def windows_code_name(code: str) -> Text:
    from app.modules.m1_rules import engine

    return engine.rules().codes.get(code, {}).get("name") or {"en": code, "hi": code, "ja": code}


# ---------------------------------------------------------------- at the airport


def plan_lounge(ctx: Ctx) -> Choice | Skip:
    cfg = windows.lounge(ctx.flight.origin)
    if cfg is None:
        return Skip("lounge", txt("skip.lounge_none", airport=ctx.flight.origin))
    if ctx.passenger is None or ctx.passenger.cabin not in cfg["cabins"]:
        return Skip("lounge", txt("skip.lounge_cabin", seat=ctx.seat))
    values = {"lounge": cfg["name"], "mark": ctx.mark}

    def apply() -> None:
        kitchen.tell_crew(ctx, f"{ctx.passenger.seat}: meal in the lounge", f"{kitchen.pax_line(ctx.passenger)} eats at {cfg['name']}.")

    return Choice("lounge", txt("why.lounge", **values), message=txt("msg.lounge", **values), apply=apply)


def plan_airside_partner(ctx: Ctx) -> Choice | Skip:
    cfg = windows.airside_partner(ctx.flight.origin)
    if cfg is None:
        return Skip("airside_partner", txt("skip.partner_none", airport=ctx.flight.origin))
    if not windows.partner_open(cfg, ctx.at):
        return Skip("airside_partner", txt("skip.partner_closed", time=windows.hhmm(ctx.at)))
    values = {"partner": cfg["name"], "time": windows.hhmm(ctx.at), "mark": ctx.mark}
    return Choice("airside_partner", txt("why.airside_partner", **values), message=txt("msg.airside_partner", **values))


# ---------------------------------------------------------------- on board


def _assign(ctx: Ctx, rung: str, item: MealItem, spec: MealSpec) -> Callable[[], MealItem]:
    def apply() -> MealItem:
        item.assigned_passenger_id = ctx.passenger.id
        ctx.session.add(item)
        where = f"galley {item.galley[-1]} ({item.position})"
        body = f"{kitchen.pax_line(ctx.passenger)}: serve {item.id}, {spec.name['en']}, from {where}."
        kitchen.tell_crew(ctx, f"{ctx.passenger.seat}: {spec.name['en']}", body, item_id=item.id, rung=rung)
        kitchen.late_checkpoint(ctx, rung, item, body)
        return item

    return apply


def plan_onboard_spare(ctx: Ctx) -> Choice | Skip:
    for item in held_items(ctx.session, ctx.passenger.id) if ctx.passenger else []:
        spec = spec_of(ctx.session, item)
        if fits(spec, ctx.strict):
            values = {"spec": spec.name, **_where(item), "mark": ctx.mark}
            return Choice("onboard_spare", txt("why.held", **values), item=item, spec=spec,
                          message=txt("msg.onboard", **values))
    run_out = ctx.kind == "run_out"
    allowed = {"spare_special"} if run_out else {"spare_special", "main_menu"}
    pid = ctx.passenger.id if ctx.passenger else None
    source = M6_SOURCE.get(ctx.channel, "gate")
    result = matcher.match(ctx.session, ctx.flight.id, ctx.strict, ctx.day["allow"], pid, source)
    if result["status"] != "matched" or result["tier"] not in allowed or result["solver"]["swaps"]:
        return Skip("onboard_spare", txt("skip.spare_runout" if run_out else "skip.spare_none"))
    item = ctx.session.get(MealItem, result["item"]["id"])
    spec = spec_of(ctx.session, item)
    values = {"spec": spec.name, **_where(item), "mark": ctx.mark}

    def apply() -> MealItem | None:
        late = matcher.reserve(ctx.session, ctx.flight.id, pid, ctx.strict, ctx.day["allow"], source)
        return ctx.session.get(MealItem, late.item_id) if late.item_id else None

    return Choice("onboard_spare", txt("why.onboard_spare", **values), item=item, spec=spec,
                  message=txt("msg.onboard", **values), apply=apply)


def released(ctx: Ctx) -> list[tuple[NoShow, MealItem]]:
    """Meals freed by no-shows that nobody holds yet."""
    out = []
    for ns in ctx.session.exec(select(NoShow).where(NoShow.flight_id == ctx.flight.id)).all():
        item = ctx.session.get(MealItem, ns.released_item_id) if ns.released_item_id else None
        if item and item.assigned_passenger_id is None and item.status in USABLE:
            out.append((ns, item))
    return out


def plan_noshow_release(ctx: Ctx) -> Choice | Skip:
    freed = released(ctx)
    if not freed:
        return Skip("noshow_release", txt("skip.release_none"))
    for ns, item in freed:
        spec = spec_of(ctx.session, item)
        seat = ctx.session.get(Passenger, ns.passenger_id).seat
        if fits(spec, ctx.strict):
            values = {"spec": spec.name, **_where(item), "seat": seat, "mark": ctx.mark}
            return Choice("noshow_release", txt("why.noshow_release", **values), item=item, spec=spec,
                          message=txt("msg.onboard", **values),
                          apply=_assign(ctx, "noshow_release", item, spec) if ctx.passenger else None)
    ns, item = freed[0]
    return Skip("noshow_release", txt("skip.release_unsafe", seat=ctx.session.get(Passenger, ns.passenger_id).seat,
                                      fired=fired_text(spec_of(ctx.session, item), ctx.strict)))


def plan_reserve_pouch(ctx: Ctx) -> Choice | Skip:
    inv = inventory.load(ctx.session, ctx.flight.id)
    free = [i for i in inv.items if i.kind == "backup" and i.id in inv.free_ids]
    if not free:
        return Skip("reserve_pouch", txt("skip.reserve_none", n=inventory.BACKUP_RESERVE))
    for item in free:
        spec = inv.specs[item.spec_id]
        if fits(spec, ctx.strict):
            values = {"spec": spec.name, **_where(item), "mark": ctx.mark}
            return Choice("reserve_pouch", txt("why.reserve_pouch", **values), item=item, spec=spec,
                          message=txt("msg.reserve_pouch", **values),
                          apply=_assign(ctx, "reserve_pouch", item, spec) if ctx.passenger else None)
    spec = inv.specs[free[0].spec_id]
    return Skip("reserve_pouch", txt("skip.reserve_unsafe", spec=spec.name, fired=fired_text(spec, ctx.strict)))
