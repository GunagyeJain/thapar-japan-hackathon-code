"""Change Router: every late need becomes one ChangeEvent, decided on the first rung still physically possible.

`submit_change(...)` is the one entry point (desk, chat, crew, feed and Chaos Mode all use it). It reads the
passenger's rules (passport, else profile, else the booking that dropped), works down the ladder for the
window it is in, applies the first fix that works, tells the passenger in their language, and records what
today's process would have done with the same event.
"""
from datetime import datetime
from typing import Any

from sqlmodel import Session, func, select

from app.core import clock
from app.core.ids import new_id
from app.core.models import Flight, MealItem, MealSpec, Passenger
from app.modules.m17_passport import service as passport
from app.modules.m18_changes import kitchen, onboard, rungs, today as today_process, windows
from app.modules.m18_changes.context import (
    Ctx, day_rules, display_name, mark_for, normalize, passenger_lang, rules_from_code, strictest,
)
from app.modules.m18_changes.models import ChangeEvent
from app.modules.m18_changes.rungs import Choice
from app.modules.m18_changes.texts import LANGS, RUNG_LABEL, TEXTS, Text, first, txt
from app.modules.m18_changes.views import assignments, event_payload  # noqa: F401 - the copilot (m20) reads these here

CHANNELS = ("chat", "radar", "checkin", "lounge", "gate", "crew", "feed", "boarding")
KINDS = ("new_need", "mind_change", "lost_request", "family_member", "no_show", "calendar", "run_out")
PLANNERS = {
    "ssr_change": rungs.plan_ssr_change,
    "caterer_add": rungs.plan_caterer_add,
    "standby_uplift": rungs.plan_standby_uplift,
    "lounge": rungs.plan_lounge,
    "airside_partner": rungs.plan_airside_partner,
    "onboard_spare": rungs.plan_onboard_spare,
    "noshow_release": rungs.plan_noshow_release,
    "reserve_pouch": rungs.plan_reserve_pouch,
    "flex_swap": onboard.plan_flex_swap,
    "sunrise_box": onboard.plan_sunrise_box,
    "unmet": onboard.plan_unmet,
}
TITLE = {"en": "{flight}: your meal", "hi": "{flight}: आपका भोजन", "ja": "{flight}：お食事について"}
FULL_STOP = {"en": ".", "hi": "।", "ja": "。"}
BRACKETS = {"en": ("(", ")", "; "), "hi": ("(", ")", "; "), "ja": ("（", "）", "、")}


def resolve_rules(session: Session, passenger: Passenger | None, given: dict[str, Any] | None,
                  kind: str) -> dict[str, Any] | None:
    """Rules sent with the change, else the passport (m17), else the profile, else the meal that dropped."""
    if given is not None:
        return normalize(given)
    if passenger is None:
        return None
    known = passport.rules_for(session, passenger.id)
    if known:
        return known
    lost = kitchen.open_lost_meal(session, passenger.id) if kind == "lost_request" else None
    if lost and lost.evidence.get("code_before"):
        return rules_from_code(lost.evidence["code_before"], lost.evidence.get("note_before"))
    return rules_from_code(passenger.ssr_meal, passenger.ssr_note) if passenger.ssr_meal else None


def make_ctx(session: Session, flight: Flight, passenger: Passenger | None, *, kind: str, channel: str, at: datetime,
             rules: dict[str, Any], note: str | None, lang: str | None, change_id: str,
             rows: tuple[int, int] | None = None) -> Ctx:
    day, tiers, strict = day_rules(rules, flight)
    long = windows.long_lead(rules, note)
    return Ctx(session=session, flight=flight, passenger=passenger, kind=kind, channel=channel, at=at,
               window=windows.window_at(flight, at, long), rules=rules, day=day, tiers=tiers, strict=strict,
               tier=strictest(tiers), lang=passenger_lang(session, passenger, lang), note=note, change_id=change_id,
               mark=mark_for(day), rows=rows, long_lead=long)


def decide(ctx: Ctx) -> tuple[Choice, list[dict[str, Any]]]:
    """Work down the ladder; return the first fix still possible and every step tried, with its reason."""
    if ctx.kind == "no_show":
        choice = onboard.no_show(ctx)
        return choice, [{"rung": choice.rung, "ok": True, "reason": choice.reason}]
    ladder = windows.rungs_for(ctx.window, ctx.kind, windows.closed_early(ctx.flight, ctx.at, ctx.long_lead))
    if not ctx.day["forbid"]:
        choice = Choice(ladder[0], txt("why.no_rules"))
        return choice, [{"rung": choice.rung, "ok": True, "reason": choice.reason}]
    steps = []
    for rung in ladder:
        result = PLANNERS[rung](ctx)
        is_choice = isinstance(result, Choice)
        steps.append({"rung": rung, "ok": is_choice and result.rung != "unmet", "reason": result.reason})
        if is_choice:
            return result, steps
    raise RuntimeError(f"ladder for {ctx.window} has no floor")


def reason_text(steps: list[dict[str, Any]]) -> Text:
    """The chosen rung's reason, then each rung skipped and why."""
    chosen, skipped = steps[-1]["reason"], steps[:-1]
    if not skipped:
        return chosen
    out = {}
    for lang, lead in zip(LANGS, TEXTS["skipped"]):
        opening, closing, sep = BRACKETS[lang]
        parts = [f"{RUNG_LABEL[s['rung']][lang]}{opening}{s['reason'][lang].rstrip('.。।')}{closing}" for s in skipped]
        out[lang] = chosen[lang] + lead + sep.join(parts) + FULL_STOP[lang]
    return out


def _passenger(session: Session, flight_id: str, passenger_id: str | None) -> Passenger | None:
    if passenger_id is None:
        return None
    pax = session.get(Passenger, passenger_id)
    if pax is None or pax.flight_id != flight_id:
        raise LookupError(f"No passenger {passenger_id} on {flight_id}")
    return pax


def _next_seq(session: Session, flight_id: str) -> int:
    top = session.exec(select(func.max(ChangeEvent.seq)).where(ChangeEvent.flight_id == flight_id)).one()
    return (top or 0) + 1


def _apply(ctx: Ctx, choice: Choice) -> tuple[MealItem | None, MealSpec | None]:
    item = choice.apply() if ctx.passenger is not None and choice.apply is not None else choice.item
    spec = ctx.session.get(MealSpec, item.spec_id) if item else choice.spec
    return item, spec


def _decision(choice: Choice, steps: list[dict[str, Any]], item: MealItem | None, spec: MealSpec | None) -> dict[str, Any]:
    return {
        "rung": choice.rung, "ok": choice.rung != "unmet",
        "item_id": item.id if item else None, "spec_id": spec.id if spec else None,
        "spec_name": spec.name if spec else None, "code": choice.code or (spec.code if spec else None),
        "kitchen_note": choice.kitchen_note, "galley": item.galley if item else None,
        "reason": reason_text(steps), "steps_tried": [s["rung"] for s in steps], "steps": steps, **choice.extra,
    }


def submit_change(session: Session, *, flight_id: str, passenger_id: str | None = None, channel: str, kind: str,
                  rules: dict[str, Any] | None = None, note: str | None = None, lang: str | None = None,
                  at: datetime | None = None, chaos_key: str | None = None, change_id: str | None = None,
                  rows: tuple[int, int] | None = None, run_out_seats: str | None = None,
                  also: list[dict[str, Any]] | None = None, quiet: bool = False) -> ChangeEvent:
    """Decide one change and record it. Raises LookupError (unknown flight/passenger), ValueError (bad input).

    `quiet`: the caller answers the passenger itself (the Calendar Radar replies to its own question)."""
    if channel not in CHANNELS or kind not in KINDS:
        raise ValueError(f"Unknown channel {channel!r} or kind {kind!r}")
    flight = session.get(Flight, flight_id)
    if flight is None:
        raise LookupError(f"No flight {flight_id}")
    pax = _passenger(session, flight_id, passenger_id)
    if chaos_key:
        done = session.exec(select(ChangeEvent).where(ChangeEvent.flight_id == flight_id,
                                                      ChangeEvent.chaos_key == chaos_key)).first()
        if done:
            return done
    if kind == "no_show" and pax is None:
        raise ValueError("A no-show needs the passenger who didn't board")
    full = resolve_rules(session, pax, rules, kind)
    if full is None and kind != "no_show":
        raise ValueError("No food rules known for this passenger: send rules with the change")
    change_id = change_id or new_id("CH")
    ctx = make_ctx(session, flight, pax, kind=kind, channel=channel, at=at or clock.now(session=session),
                   rules=full or {}, note=note, lang=lang, change_id=change_id, rows=rows)
    today = today_process.today_for(ctx, run_out_seats)  # before any write: a no-show still holds their meal
    choice, steps = decide(ctx)
    item, spec = _apply(ctx, choice)
    decision = _decision(choice, steps, item, spec)
    if also:
        decision["also"] = also
    message = first(choice.message, ctx.lang) if pax is not None else None
    event = ChangeEvent(
        id=change_id, flight_id=flight_id, seq=_next_seq(session, flight_id), passenger_id=pax.id if pax else None,
        seat=pax.seat if pax else None, name=display_name(pax) if pax else None, at=ctx.at, channel=channel,
        kind=kind, window=ctx.window, decision=decision, message=message, today=today,
        request={"forbid": ctx.day["forbid"], "allow": ctx.day["allow"], "tiers": ctx.tiers,
                 "tier": "none" if kind == "no_show" else ctx.tier,
                 "note": note, "lang": ctx.lang, "allergens": (full or {}).get("allergens", []),
                 "time_rules": (full or {}).get("time_rules", []), "flex": bool((full or {}).get("flex")),
                 "long_lead": ctx.long_lead},
        status="done" if pax is not None else "waiting", chaos_key=chaos_key,
    )
    session.add(event)
    session.flush()
    if message and not quiet:
        kitchen.tell_passenger(session, pax, message, ctx.lang, change_id,
                               {lang_: tpl.format(flight=flight.flight_no) for lang_, tpl in TITLE.items()})
    return event


def fix_quietly(session: Session, flight: Flight, pax: Passenger, *, kind: str, channel: str, at: datetime,
                change_id: str, rows: tuple[int, int] | None = None) -> dict[str, Any]:
    """Serve one more passenger inside someone else's change (a run-out covers several seats): the same
    ladder and writes, recorded on the parent event's `also` list instead of a log line of its own."""
    rules = resolve_rules(session, pax, None, kind) or {}
    ctx = make_ctx(session, flight, pax, kind=kind, channel=channel, at=at, rules=rules, note=None, lang=None,
                   change_id=change_id, rows=rows)
    choice, steps = decide(ctx)
    item, spec = _apply(ctx, choice)
    if choice.message:
        kitchen.tell_passenger(session, pax, first(choice.message, ctx.lang), ctx.lang, change_id,
                               {lang_: tpl.format(flight=flight.flight_no) for lang_, tpl in TITLE.items()})
    return {"passenger_id": pax.id, "seat": pax.seat, "name": display_name(pax), "rung": choice.rung,
            "ok": choice.rung != "unmet", "item_id": item.id if item else None, "spec_id": spec.id if spec else None,
            "spec_name": spec.name if spec else None, "tier": ctx.tier, "reason": reason_text(steps)}

