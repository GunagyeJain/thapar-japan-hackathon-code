"""What each demo step does on the server.

Steps drive the other modules through their HTTP contracts (shared/api.md), called in-process,
so the story keeps working whichever way an owner structures their code. If a module's route
isn't on main yet (404), a small stand-in here produces the same checkpoint, alert and
notification, so rehearsals can run. Every action checks state first: running it twice
changes nothing.
"""
from datetime import datetime
from typing import Any

from sqlmodel import Session, select

from app.core import alerts, clock, events, outbox
from app.core.db import new_session
from app.core.models import Alert, Flight, MealItem, MealPromise, Passenger, Profile
from app.core.seed import FLIGHT_ID, reset
from app.core.settings import seed_epoch
from app.modules.m1_rules import engine

PRIYA_SEAT, MEHTA_SEAT, SHAH_SEAT, VERMA_SEAT = "23C", "31K", "27D", "24A"
PRIYA_NEW_PNR, PRIYA_NEW_INBOUND = "8MZ2TN", {"flight": "6E5102", "from": "BOM", "date": "2026-10-24"}
CATERER = "Skyline Flight Kitchens · shift lead"
OPS = "JAL ops · demo"
NOT_THERE = 404
MISSING_ROUTE = (404, 405)  # 405: the SPA catch-all answers GET only


class StepError(RuntimeError):
    """A module answered with an error the story can't work around."""


def _client():
    from fastapi.testclient import TestClient

    from app.main import app  # late import: app.main imports every module, this one included

    return TestClient(app)


def _call(method: str, path: str, body: Any = None) -> tuple[int, Any]:
    """(status, json). A route that isn't on main yet comes back as NOT_THERE."""
    res = _client().request(method, f"/api{path}", json=body)
    if res.status_code in MISSING_ROUTE:
        return NOT_THERE, None
    if res.status_code >= 400:
        raise StepError(f"{method} {path} → {res.status_code}: {res.text[:200]}")
    return res.status_code, res.json()


def _pax(session: Session, seat: str) -> Passenger:
    pax = session.exec(select(Passenger).where(Passenger.flight_id == FLIGHT_ID, Passenger.seat == seat)).first()
    if pax is None:
        raise StepError(f"No passenger in {seat}")
    return pax


def _promise(session: Session, passenger_id: str) -> MealPromise | None:
    return session.exec(select(MealPromise).where(MealPromise.passenger_id == passenger_id)).first()


def _open_alert(session: Session, type_: str, passenger_id: str) -> Alert | None:
    return session.exec(
        select(Alert).where(Alert.type == type_, Alert.passenger_id == passenger_id, Alert.status != "resolved")
    ).first()


# ---------------------------------------------------------------- step 0


def fresh_start(did: list[str]) -> None:
    """Reset, keeping judges. Skipped when nothing has happened since the last reset."""
    from app.modules.m11_story import state

    if state.is_fresh():
        did.append("Already reset; nothing has happened since.")
        return
    epoch = reset(keep_judges=True)
    state.mark_reset(epoch)
    did.append(f"Reset the demo (seed epoch {epoch}), judges kept.")


# ---------------------------------------------------------------- step 1


PRIYA_PRESETS = ["vegetarian", "no_onion_garlic"]


def priya_profile(did: list[str]) -> None:
    with new_session() as s:
        priya = _pax(s, PRIYA_SEAT)
        has_promise = _promise(s, priya.id) is not None
        pid = priya.id
    if has_promise:
        did.append("Priya's profile is already saved.")
    else:
        rules = engine.combine_presets(PRIYA_PRESETS)
        code = engine.code_options(rules["forbid"], rules["allow"])[0]["code"]
        body = {"passenger_id": pid, "lang": "en", "presets": PRIYA_PRESETS, **rules, "chosen_code": code,
                "consent": {"this_trip": True, "save_profile": True, "share_with_caterer": True, "cross_border_ack": True}}
        status, _ = _call("POST", "/profiles", body)
        if status == NOT_THERE:
            raise StepError("m3's /api/profiles isn't on main yet")
        did.append(f"Saved Priya's profile: {' + '.join(PRIYA_PRESETS)} → {code}.")
    wrong_code_for_verma(did)


def wrong_code_for_verma(did: list[str]) -> None:
    """24A booked HNML but eats vegetarian. m4's reconciler raises this; make sure it's there."""
    with new_session() as s:
        verma = _pax(s, VERMA_SEAT)
        if _open_alert(s, "WRONG_CODE", verma.id):
            return
        profile = s.get(Profile, verma.profile_id) if verma.profile_id else None
        check = engine.check_booking(profile.forbid if profile else [], verma.ssr_meal) if profile else {"ok": True}
        if check["ok"]:
            return
        promise = _promise(s, verma.id)
        suggested = check.get("suggested_code")
        alerts.raise_alert(
            FLIGHT_ID, "WRONG_CODE", "warning", f"{verma.seat} {verma.surname}: booked {verma.ssr_meal}, needs {suggested}",
            check["problem"]["message"]["en"], passenger_id=verma.id, promise_id=promise.id if promise else None,
            evidence={"booked_code": verma.ssr_meal, "contains": check["problem"]["contains"], "suggested_code": suggested},
            session=s,
        )
        s.commit()
    did.append("Raised WRONG_CODE for 24A (booked HNML, eats vegetarian).")


# ---------------------------------------------------------------- steps 2 and 3


def rebook_drops_meal(did: list[str]) -> None:
    with new_session() as s:
        priya = _pax(s, PRIYA_SEAT)
        if priya.pnr == PRIYA_NEW_PNR:
            did.append("Priya is already rebooked.")
            return
        pid = priya.id
    status, _ = _call("POST", "/sim/booking-events", {"type": "rebook_drop_meal", "passenger_id": pid})
    if status == NOT_THERE:
        _stand_in_rebook(pid)
    did.append("Rebooked Priya's inbound (6E5318 → 6E5102, 6XK2QP → 8MZ2TN); the ADL dropped her AVML.")


def _stand_in_rebook(pid: str) -> None:
    """Until m4 ships: the reconciler's effects of the rebooking ADL."""
    with new_session() as s:
        priya, flight = s.get(Passenger, pid), s.get(Flight, FLIGHT_ID)
        before = {"pnr": priya.pnr, "inbound": priya.inbound, "ssr": f"{priya.ssr_meal} {priya.ssr_note or ''}".strip()}
        priya.pnr, priya.inbound, priya.ssr_meal, priya.ssr_note = PRIYA_NEW_PNR, PRIYA_NEW_INBOUND, None, None
        s.add(priya)
        promise = _promise(s, pid)
        detail = f"{priya.seat}: rebooking ADL has no meal SSR ({before['pnr']} → {PRIYA_NEW_PNR})"
        events.record_checkpoint(promise.id if promise else None, pid, FLIGHT_ID, "C2", "fail", "pnl/adl", detail,
                                 key=f"story:c2-fail:{pid}", session=s)
        alerts.raise_alert(
            FLIGHT_ID, "LOST_MEAL", "critical", "Meal request dropped after rebooking",
            f"{priya.seat} {priya.surname}/{priya.given}: {before['ssr']} was on {before['pnr']}; the new booking {PRIYA_NEW_PNR} has no meal request.",
            passenger_id=pid, promise_id=promise.id if promise else None, deadline_at=flight.caterer_final_list_at,
            evidence={"old_pnr": before["pnr"], "new_pnr": PRIYA_NEW_PNR, "inbound_before": before["inbound"],
                      "inbound_after": PRIYA_NEW_INBOUND, "line_before": f".R/{before['ssr']}", "line_after": None},
            session=s,
        )
        s.commit()


def request_again(did: list[str]) -> None:
    with new_session() as s:
        priya = _pax(s, PRIYA_SEAT)
        alert = _open_alert(s, "LOST_MEAL", priya.id)
        if alert is None:
            did.append("Priya's meal is already requested again.")
            return
        alert_id, pid = alert.id, priya.id
    status, _ = _call("POST", f"/alerts/{alert_id}/actions", {"action": "request_again", "actor": OPS})
    if status == NOT_THERE:
        _stand_in_request_again(pid, alert_id)
    did.append("Requested Priya's AVML again on 8MZ2TN; C2 is fixed.")


def _stand_in_request_again(pid: str, alert_id: str) -> None:
    """Until m4 ships: the corrected ADL restores the SSR, C2 fixed, alert resolved, passenger told."""
    with new_session() as s:
        priya, promise, alert = s.get(Passenger, pid), _promise(s, pid), s.get(Alert, alert_id)
        priya.ssr_meal = promise.code if promise else "AVML"
        priya.ssr_note = promise.kitchen_note if promise else None
        s.add(priya)
        events.record_checkpoint(promise.id if promise else None, pid, FLIGHT_ID, "C2", "fixed", "pnl/adl",
                                 f"{priya.seat}: {priya.ssr_meal} {priya.ssr_note or ''} back on {priya.pnr}".strip(),
                                 key=f"story:c2-fixed:{pid}", session=s)
        now = clock.now(session=s).isoformat()
        alert.status = "resolved"
        alert.actions = [*alert.actions, {"action": "request_again", "actor": OPS, "at": now},
                         {"action": "resolve", "actor": "watcher", "at": now, "note": "Corrected ADL received"}]
        s.add(alert)
        mark = (promise.label_mark or {}).get("en", "your meal") if promise else "your meal"
        outbox.notify("sms", pid, "Your meal is back on JL740", f"Your meal ({mark}) is back on JL740.", session=s)
        s.commit()


# ---------------------------------------------------------------- step 4


def caterer_v3(did: list[str], acknowledge: bool) -> None:
    status, versions = _call("GET", f"/flights/{FLIGHT_ID}/meal-lists")
    if status == NOT_THERE:
        if acknowledge:
            _stand_in_ack()
            did.append("Caterer acknowledged meal list v3; C3 written for every promise.")
        else:
            did.append("Meal list v3 is waiting for the caterer.")
        return
    latest = versions[0] if versions else None
    if latest is None or latest["version"] < 3:
        _, latest = _call("POST", f"/flights/{FLIGHT_ID}/meal-lists", {})
        did.append(f"Cut meal list v{latest['version']}.")
    if acknowledge and not latest.get("ack_at"):
        _call("POST", f"/meal-lists/{latest['id']}/ack", {"by": CATERER})
        did.append(f"Caterer acknowledged v{latest['version']}.")


def _stand_in_ack() -> None:
    """Until m7 ships: what acknowledging the list writes (C3 for every promise)."""
    with new_session() as s:
        for promise in s.exec(select(MealPromise).where(MealPromise.flight_id == FLIGHT_ID)).all():
            if promise.checkpoints.get("C3") in ("ok", "fixed"):
                continue
            events.record_checkpoint(promise.id, promise.passenger_id, FLIGHT_ID, "C3", "ok", "caterer",
                                     f"Meal list v3 acknowledged · {CATERER}", key=f"story:c3:{promise.id}", session=s)
        s.commit()


# ---------------------------------------------------------------- step 5


MEHTA_PRESETS = ["jain"]


def reserve_for_mehta(did: list[str]) -> None:
    with new_session() as s:
        pid = _pax(s, MEHTA_SEAT).id
    rules = engine.combine_presets(MEHTA_PRESETS)
    _, res = _call("POST", "/late-requests", {"flight_id": FLIGHT_ID, "passenger_id": pid, **rules, "source": "gate"})
    item = res["match"].get("item")
    did.append(f"31K Mehta: {item['id']} ({item['spec']['code'] or item['kind']}, galley {item['galley'][-1]}) reserved." if item
               else "31K Mehta: voucher issued.")


# ---------------------------------------------------------------- step 7


def crew_events(did: list[str]) -> None:
    """The tablet's queued events after landing the offline part: galley G1 check, 27D backup, seat scans."""
    from app.modules.m6_matcher.inventory import load

    with new_session() as s:
        inv = load(s, FLIGHT_ID)
        shah, priya, mehta = _pax(s, SHAH_SEAT), _pax(s, PRIYA_SEAT), _pax(s, MEHTA_SEAT)
        held = inv.holder_of()
        g1 = [i for i in inv.items if i.kind == "special" and i.galley == "G1" and i.assigned_passenger_id]
        shah_tray = held.get(shah.id)
        backup = held.get(shah.id) if shah_tray and shah_tray.kind == "backup" else _galley_backup(inv)
        epoch = seed_epoch(session=s)
        at = clock.now(session=s)
        evs = [_ev("galley_found", i.id, at) for i in g1 if not shah_tray or i.id != shah_tray.id]
        if shah_tray and shah_tray.kind == "special":
            evs.append(_ev("galley_missing", shah_tray.id, at))
        if backup:
            evs.append(_ev("swap_backup", backup.id, at, passenger_id=shah.id))
        for pax, item in ((priya, held.get(priya.id)), (shah, backup), (mehta, held.get(mehta.id))):
            if item:
                evs.append(_ev("seat_scan", item.id, at, seat=pax.seat, verdict=_verdict(s, pax, item)))
    status, res = _call("POST", f"/flights/{FLIGHT_ID}/crew-events", {"seed_epoch": epoch, "events": evs})
    if status == NOT_THERE:
        raise StepError("m8's crew-events endpoint isn't on main yet")
    found = sum(1 for e in evs if e["type"] == "galley_found")
    did.append(f"Synced {res['accepted']} crew events ({res['duplicates']} already in): galley G1 {found} of {len(g1)}, "
               f"27D on backup {backup.id if backup else '—'}, seat scans for 23C, 27D, 31K.")


def _galley_backup(inv):
    """The first sealed backup held for galley contingencies."""
    reserve = [i for i in inv.items if i.id in inv.reserve_ids]
    return reserve[0] if reserve else None


def _verdict(session: Session, pax: Passenger, item: MealItem) -> str:
    profile = session.get(Profile, pax.profile_id) if pax.profile_id else None
    forbid = profile.forbid if profile else _late_forbid(session, pax.id)
    if forbid is None:
        return "NEEDS_HUMAN"
    from app.core.models import MealSpec

    spec = session.get(MealSpec, item.spec_id)
    return engine.evaluate(forbid, engine.spec_tags(spec.tags, spec.certified))["verdict"]


def _late_forbid(session: Session, passenger_id: str) -> list[str] | None:
    from app.modules.m6_matcher.models import LateRequest

    lr = session.exec(select(LateRequest).where(LateRequest.passenger_id == passenger_id)).first()
    return lr.forbid if lr else None


def _ev(type_: str, item_id: str, at: datetime, **extra) -> dict:
    """Fixed client ids, so syncing the same story twice is a no-op on the server."""
    who = extra.get("passenger_id") or extra.get("seat") or ""
    return {"client_id": f"story-{type_}-{item_id}-{who}", "type": type_, "item_id": item_id, "at": at.isoformat(), **extra}


# ---------------------------------------------------------------- v2 story (docs/plan/v2.md)

# What Priya ticks on JAL's special-meal form (/jal): Vegetarian, Onion & garlic, Purnima fast.
PRIYA_FORM = {"forbid": ["meat", "seafood", "egg", "gelatin", "onion", "garlic"], "allow": ["dairy"], "allergens": []}


def _purnima_rule() -> dict[str, Any]:
    """The form's Purnima tile: every Purnima date, asked about before it changes a meal (confirm)."""
    days = next(o["days"] for o in engine.calendar()["observances"] if o["id"] == "purnima")
    return {"id": "TR-purnima", "kind": "dates", "dates": [d["date"] for d in days], "preset": "vrat", "confirm": True}


def _priya_id() -> str:
    with new_session() as session:
        return _pax(session, PRIYA_SEAT).id


def priya_passport(did: list[str]) -> None:
    """Priya fills the special-meal form on JAL's My Booking; the passport is saved (Act 1)."""
    pid = _priya_id()
    status, have = _call("GET", f"/passport/{pid}")
    if status != NOT_THERE and have:
        did.append("Priya's meal form was already saved")
        return
    rules = {**PRIYA_FORM, "time_rules": [_purnima_rule()]}
    status, saved = _call("POST", "/passport", {"passenger_id": pid, "lang": "en", "rules": rules, "source": "form"})
    if status == NOT_THERE:
        raise StepError("The meal form isn't on this build yet")
    plan = (saved or {}).get("plan") or {}
    did.append(f"Priya's form saved: {plan.get('code') or plan.get('main_pick')} {plan.get('kitchen_note') or ''}".strip())


def radar_scan(did: list[str]) -> None:
    """The Calendar Radar checks Priya's trip dates against her time rules (runs on every visit to step 2)."""
    status, out = _call("POST", "/radar/scan", {"passenger_id": _priya_id()})
    if status == NOT_THERE:
        did.append("Radar not on this build yet")
        return
    did.append(f"Radar asked {len(out.get('asked', []))}, quiet {out.get('quiet', 0)}")


def radar_yes(did: list[str]) -> None:
    """Priya answers Yes to the Radar's question about 25 Oct."""
    pid = _priya_id()
    _, notes = _call("GET", f"/notifications?to={pid}")
    questions = [n for n in (notes or []) if (n.get("ref") or {}).get("kind") == "radar_question"]
    if not questions:
        raise StepError("No Radar question for Priya yet: run step 2 first")
    try:
        _, out = _call("POST", "/radar/answer", {"question_id": questions[0]["ref"]["question_id"], "option_id": "yes"})
    except StepError as exc:
        if "answered" in str(exc).lower():
            did.append("Priya already answered")
            return
        raise
    did.append(f"Priya said yes: {((out or {}).get('plan') or {}).get('kitchen_note') or 'fasting meal'}")


def seat_check(did: list[str]) -> None:
    """The crew ask the seat screens before the meal; Priya taps Yes at 23C (m22). Before the tray scans, which
    mark her tray served."""
    status, asked = _call("GET", f"/seatback/{FLIGHT_ID}")
    if status == NOT_THERE:
        did.append("Seat screens not on this build yet")
        return
    priya = next((s for s in asked["seats"] if s["seat"] == PRIYA_SEAT), None)
    if priya is None:
        _, asked = _call("POST", "/seatback/ask", {"flight_id": FLIGHT_ID})
        did.append(f"Seat screens asked {asked['counts']['asked']} passengers")
        priya = next((s for s in asked["seats"] if s["seat"] == PRIYA_SEAT), None)
    if priya is None:
        did.append(f"{PRIYA_SEAT} has no special or held meal to confirm")
        return
    if priya["status"] in ("confirmed", "changed"):
        did.append(f"{PRIYA_SEAT} already answered on the seat screen")
        return
    _call("POST", "/seatback/answer", {"flight_id": FLIGHT_ID, "seat": PRIYA_SEAT, "answer": "yes"})
    did.append(f"{PRIYA_SEAT} said Yes on the seat screen: confirmed at seat")


def in_the_air(did: list[str]) -> None:
    """Step 4's "Do it for me": the seat screens' question, then the tablet's queued scans."""
    seat_check(did)
    crew_events(did)


def chaos_run(did: list[str]) -> None:
    """Chaos Mode: the seven scripted late changes for JL740 go through the change router (Act 2)."""
    status, out = _call("POST", "/chaos/run", {"flight_id": FLIGHT_ID, "preset": "jl740"})
    if status == NOT_THERE:
        raise StepError("Chaos Mode isn't on this build yet")
    events = (out or {}).get("events", [])
    did.append(f"Chaos Mode: {len(events)} changes, {sum(1 for e in events if e.get('decision', {}).get('ok'))} met")
