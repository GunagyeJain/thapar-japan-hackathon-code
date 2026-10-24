"""Ingest PNL/ADL copies, apply them to Passenger rows, and reconcile every meal promise (C2).

Read-only towards the airline: we only read message copies. The simulator plays the reservations
agent and the departure control system, so the demo can produce the messages they would send.
"""
import secrets
from datetime import date, timedelta
from types import SimpleNamespace
from typing import Any

from sqlmodel import Session, func, select

from app.core import alerts, clock, events, outbox
from app.core.db import use_session
from app.core.ids import ALPHABET, new_id
from app.core.seed import FLIGHT_ID
from app.core.models import Alert, Flight, MealPromise, Passenger, Profile, RawMessage
from app.modules.m1_rules.engine import check_booking

from .parser import ddmmm, name_line, parse, passenger_lines, render_adl, type_b

BOOKING = ("surname", "given", "title", "pnr", "seat", "cabin", "ssr_meal", "ssr_note", "inbound", "group")
M4_ALERTS = ("LOST_MEAL", "WRONG_CODE")
DEFAULT_REBOOK = {"PX-0057": ("8MZ2TN", "6E5102")}  # Priya, as in the story


def display_name(p: Passenger) -> str:
    return f"{p.given.title()} {p.surname.title()}"


def type_b_name(p) -> str:
    return f"{p['surname']}/{p['given']} {p['title']}"


def snapshot(session: Session, flight_id: str) -> dict[str, dict[str, Any]]:
    rows = session.exec(select(Passenger).where(Passenger.flight_id == flight_id, Passenger.is_judge == False)).all()  # noqa: E712
    return {p.id: {k: getattr(p, k) for k in BOOKING} for p in rows}


def _find(session: Session, flight_id: str, row: dict) -> Passenger:
    same_pnr = session.exec(select(Passenger).where(Passenger.flight_id == flight_id, Passenger.pnr == row["pnr"])).all()
    p = next((p for p in same_pnr if (type_b(p.surname), type_b(p.given)) == (row["surname"], row["given"])), None)
    if not p:
        raise ValueError(f"no passenger {row['surname']}/{row['given']} on PNR {row['pnr']}")
    return p


def _meal(row: dict) -> tuple[str | None, str | None]:
    ssr = row["ssr"][0] if row["ssr"] else None
    return (ssr["code"], ssr["text"] or None) if ssr else (None, None)


def _set_full(p: Passenger, row: dict) -> None:
    """Apply a complete booking (PNL entry or the ADD half of a rebooking)."""
    p.pnr, p.inbound, p.group = row["pnr"], row["inbound"], row["group"]
    p.ssr_meal, p.ssr_note = _meal(row)
    p.seat = row["seat"] or p.seat
    p.cabin = row["cabin"] or p.cabin


def _create(session: Session, flight_id: str, row: dict) -> None:
    if not row["seat"]:
        raise ValueError(f"cannot add {row['surname']}/{row['given']} without a seat")
    ids = session.exec(select(Passenger.id).where(Passenger.flight_id == flight_id)).all()
    nums = [int(i[3:]) for i in ids if i[3:].isdigit()]
    p = Passenger(id=f"PX-{max(nums, default=0) + 1:04d}", flight_id=flight_id, seat=row["seat"],
                  cabin=row["cabin"], surname=row["surname"], given=row["given"], title=row["title"] or "", pnr=row["pnr"])
    _set_full(p, row)
    session.add(p)


def apply(session: Session, flight_id: str, msg: dict) -> None:
    """Apply a parsed message to Passenger rows. A DEL and an ADD of the same name in one ADL is a rebooking."""
    key = lambda r: (r["surname"], r["given"], r["title"])  # noqa: E731
    if msg["kind"] == "PNL":
        for row in msg["rows"]:
            try:
                p = _find(session, flight_id, row)
            except ValueError:
                _create(session, flight_id, row)
                continue
            _set_full(p, row)
            session.add(p)
        session.flush()
        return
    adds = {key(r): r for r in msg["rows"] if r["action"] == "ADD"}
    dels = {key(r) for r in msg["rows"] if r["action"] == "DEL"}
    for row in msg["rows"]:
        if row["action"] == "DEL" and key(row) in adds:
            p = _find(session, flight_id, row)
            _set_full(p, adds[key(row)])
            session.add(p)
        elif row["action"] == "DEL":
            # shortcut: an offloaded passenger is deleted outright; their promise rows stay behind. Fine for the demo feed.
            session.delete(_find(session, flight_id, row))
        elif row["action"] == "ADD" and key(row) not in dels:
            _create(session, flight_id, row)
        elif row["action"] == "CHG":
            p = _find(session, flight_id, row)
            if row["ssr"]:
                p.ssr_meal, p.ssr_note = _meal(row)
            p.seat = row["seat"] or p.seat
            p.inbound = row["inbound"] or p.inbound
            p.group = row["group"] or p.group
            session.add(p)
    session.flush()


def diff(before: dict, after: dict) -> list[dict]:
    """Change[] as in shared/api.md."""
    out = []
    for pid in before.keys() - after.keys():
        b = before[pid]
        out.append({"kind": "removed", "passenger_id": pid, "pnr": b["pnr"], "name": type_b_name(b)})
    for pid in after.keys() - before.keys():
        a = after[pid]
        out.append({"kind": "added", "passenger_id": pid, "pnr": a["pnr"], "name": type_b_name(a)})
    for pid in before.keys() & after.keys():
        b, a = before[pid], after[pid]
        out += [{"kind": "changed", "passenger_id": pid, "pnr": a["pnr"], "name": type_b_name(a),
                 "field": f, "before": b[f], "after": a[f]} for f in BOOKING if b[f] != a[f]]
    return out


def _resolve(alert: Alert, actor: str, note: str, now) -> None:
    alert.status = "resolved"
    alert.actions = [*alert.actions, {"action": "resolve", "actor": actor, "at": now.isoformat(), "note": note}]


def _fixed_text(p: Passenger, flight: Flight, promise: MealPromise | None) -> str:
    mark = (promise.label_mark or {}).get("en") if promise else None
    if mark and " · " in mark:
        head, rest = mark.split(" · ", 1)
        return f"Your {head.lower()} meal ({rest}) is back on {flight.flight_no}."
    what = f"{p.ssr_meal} meal" + (f" ({p.ssr_note.lower()})" if p.ssr_note else "")
    return f"Your {what} is back on {flight.flight_no}."


def reconcile(session: Session, flight: Flight, msg: RawMessage, before: dict, parsed: dict) -> list[Alert]:
    """Check every promise (and every booking that just lost its meal) against the booking. Writes C2."""
    now = clock.now(session=session)
    after = snapshot(session, flight.id)
    promises = {m.passenger_id: m for m in session.exec(select(MealPromise).where(MealPromise.flight_id == flight.id)).all()}
    open_alerts: dict[str, list[Alert]] = {}
    for a in session.exec(select(Alert).where(Alert.flight_id == flight.id, Alert.type.in_(M4_ALERTS),  # type: ignore[attr-defined]
                                              Alert.status != "resolved")).all():
        open_alerts.setdefault(a.passenger_id, []).append(a)
    dropped = {pid for pid, a in after.items() if not a["ssr_meal"] and (before.get(pid) or {}).get("ssr_meal")}
    prev_msg = session.exec(select(RawMessage.id).where(RawMessage.flight_id == flight.id, RawMessage.seq == msg.seq - 1)).first()
    touched: list[Alert] = []

    for pid in sorted((promises.keys() & after.keys()) | dropped | (open_alerts.keys() & after.keys())):
        p = session.get(Passenger, pid)
        promise = promises.get(pid)
        profile = session.get(Profile, promise.profile_id) if promise else None
        c2 = lambda result, detail, data=None: events.record_checkpoint(  # noqa: E731
            promise.id if promise else None, pid, flight.id, "C2", result, "pnl_adl_watcher", detail, data,
            key=f"C2:{pid}:{msg.id}", session=session)
        state = promise.checkpoints.get("C2") if promise else None

        if not p.ssr_meal and (promise or pid in dropped):
            b = before.get(pid) or after[pid]
            lost_code = b["ssr_meal"] or (promise.code if promise else None)
            lines_after = []
            for r in parsed["rows"]:
                if parsed["kind"] == "ADL" and (r["surname"], r["given"]) == (type_b(p.surname), type_b(p.given)):
                    lines_after += [r["action"], *r["lines"]]
            rebooked = b["pnr"] != p.pnr
            alert = alerts.raise_alert(
                flight.id, "LOST_MEAL", "critical", "Meal request dropped after rebooking" if rebooked else "Meal request missing from booking",
                f"{display_name(p)} ({p.seat}) had {lost_code}{' · ' + b['ssr_note'] if b['ssr_note'] else ''} on PNR {b['pnr']}. "
                + (f"The rebooking to PNR {p.pnr} arrived without it. " if rebooked else "The latest message has no meal request. ")
                + f"Request it again before the caterer's final list at {flight.caterer_final_list_at.astimezone(clock.IST):%H:%M}.",
                passenger_id=pid, promise_id=promise.id if promise else None, deadline_at=flight.caterer_final_list_at,
                evidence={"message_ids": [i for i in (prev_msg, msg.id) if i], "code_before": lost_code, "note_before": b["ssr_note"],
                          "lines_before": passenger_lines(SimpleNamespace(**b), flight.origin), "lines_after": lines_after,
                          "line_before": f".R/{lost_code} HK1" + (f" {b['ssr_note']}" if b["ssr_note"] else ""), "line_after": None,
                          "old_pnr": b["pnr"], "new_pnr": p.pnr, "inbound_before": b["inbound"], "inbound_after": p.inbound},
                session=session)
            is_new = alert not in open_alerts.get(pid, [])
            if (promise and state != "fail") or (not promise and is_new):
                c2("fail", f"{lost_code} missing from booking {p.pnr}", {"alert_id": alert.id})
            if is_new:
                touched.append(alert)
            continue

        check = check_booking(profile.forbid, p.ssr_meal) if profile else {"ok": True}
        if not check["ok"]:
            alert = alerts.raise_alert(
                flight.id, "WRONG_CODE", "warning", "Booked meal code breaks the passenger's food rules",
                f"{display_name(p)} ({p.seat}): {check['problem']['message']['en']}"
                + (f" Book {check['suggested_code']} instead." if check.get("suggested_code") else ""),
                passenger_id=pid, promise_id=promise.id if promise else None, deadline_at=flight.caterer_final_list_at,
                evidence={"message_ids": [msg.id], "booked_code": p.ssr_meal, "promised_code": promise.code if promise else None,
                          "suggested_code": check.get("suggested_code"), "contains": check["problem"]["contains"]},
                session=session)
            if state != "fail":
                c2("fail", f"Booked {p.ssr_meal} breaks the passenger's rules", {"alert_id": alert.id})
            if alert not in open_alerts.get(pid, []):
                touched.append(alert)
            continue

        stale = open_alerts.get(pid, [])
        if stale:
            for a in stale:
                _resolve(a, "feed", f"{msg.kind} {msg.id}: booking has {p.ssr_meal} again", now)
                session.add(a)
                touched.append(a)
            c2("fixed", f"{p.ssr_meal} back on booking {p.pnr}")
            outbox.notify("sms", pid, "Your meal is restored", _fixed_text(p, flight, promise),
                          lang=profile.lang if profile else "en", ref={"alert_ids": [a.id for a in stale]}, session=session)
        elif promise and state == "pending":
            c2("ok", f"Booking has {p.ssr_meal}" + (f" ({p.ssr_note})" if p.ssr_note else ""))
    return touched


def ingest(text: str, *, session: Session | None = None) -> dict[str, Any]:
    """Store a PNL/ADL copy, apply it, reconcile. Returns {message, changes, alerts}."""
    with use_session(session) as s:
        parsed = parse(text, clock.now(session=s).year)
        flight = s.get(Flight, f"{parsed['flight_no']}-{parsed['date'].replace('-', '')}")
        if not flight or flight.origin != parsed["origin"]:
            raise ValueError(f"no flight {parsed['flight_no']} on {parsed['date']} from {parsed['origin']}")
        seq = s.exec(select(func.count()).select_from(RawMessage).where(RawMessage.flight_id == flight.id)).one() + 1
        msg = RawMessage(id=new_id("MSG"), flight_id=flight.id, kind=parsed["kind"], seq=seq,
                         received_at=clock.now(session=s), text=text)
        s.add(msg)
        before = snapshot(s, flight.id)
        apply(s, flight.id, parsed)
        touched = reconcile(s, flight, msg, before, parsed)
        return {"message": msg, "changes": diff(before, snapshot(s, flight.id)), "alerts": touched}


def _cabin_count(session: Session, flight_id: str, cabin: str) -> int:
    return session.exec(select(func.count()).select_from(Passenger).where(
        Passenger.flight_id == flight_id, Passenger.cabin == cabin, Passenger.is_judge == False)).one()  # noqa: E712


def build_adl(session: Session, event_type: str, passenger_id: str, **params) -> str:
    """The ADL that the airline's systems would send for this booking event."""
    p = session.get(Passenger, passenger_id)
    if not p:
        raise ValueError(f"no passenger {passenger_id}")
    flight = session.get(Flight, p.flight_id)
    booked = _cabin_count(session, flight.id, p.cabin)
    if event_type == "rebook_drop_meal":
        pnr, inbound_flight = DEFAULT_REBOOK.get(p.id, ("".join(secrets.choice(ALPHABET) for _ in range(6)), None))
        inbound_flight = params.get("inbound_flight", inbound_flight)
        inbound = {**p.inbound, "flight": inbound_flight} if p.inbound and inbound_flight else p.inbound
        new = SimpleNamespace(**{k: getattr(p, k) for k in BOOKING})
        new.pnr, new.inbound, new.ssr_meal, new.ssr_note = params.get("new_pnr", pnr), inbound, None, None
        return render_adl(flight, p.cabin, booked, [("DEL", [name_line(p)]), ("ADD", passenger_lines(new, flight.origin))])
    if event_type == "restore_meal":
        code, note = params.get("code"), params.get("note")
        if not code:
            raise ValueError("restore_meal needs a code")
        return render_adl(flight, p.cabin, booked, [("CHG", [name_line(p), f".R/{code} HK1" + (f" {note}" if note else "")])])
    if event_type == "seat_change":
        if not params.get("seat"):
            raise ValueError("seat_change needs a seat")
        return render_adl(flight, p.cabin, booked, [("CHG", [name_line(p), f".R/SEAT HK1 {params['seat']}"])])
    raise ValueError(f"unsupported booking event {event_type}")


def simulate(event_type: str, passenger_id: str | None = None, *, session: Session | None = None, **params) -> dict[str, Any]:
    """Emit the ADL for a booking event and ingest it, as if it came off the feed. `delay` sends no message."""
    with use_session(session) as s:
        if event_type == "delay":
            return delay(s, params.get("flight_id", FLIGHT_ID), int(params.get("minutes", 0)))
        if not passenger_id:
            raise ValueError(f"{event_type} needs a passenger_id")
        return ingest(build_adl(s, event_type, passenger_id, **params), session=s)


def delay(session: Session, flight_id: str, minutes: int) -> dict[str, Any]:
    """A late departure: meal carts must wait, or chilled meals sit out too long. DELAY_HOLD + the caterer is told."""
    flight = session.get(Flight, flight_id)
    if not flight:
        raise ValueError(f"no flight {flight_id}")
    if minutes <= 0:
        raise ValueError("delay needs minutes > 0")
    before = {"delay_min": flight.delay_min, "status": flight.status}
    flight.delay_min, flight.status = minutes, "delayed"
    session.add(flight)
    late = timedelta(minutes=minutes)
    etd, dispatch = (flight.std + late).astimezone(clock.IST), (flight.dispatch_at + late).astimezone(clock.IST)
    body = (f"{flight.flight_no} now departs {etd:%H:%M}, {minutes} min late. Hold the meal carts: "
            f"dispatch moves from {flight.dispatch_at.astimezone(clock.IST):%H:%M} to {dispatch:%H:%M}.")
    # A new delay replaces the old hold, so the latest times are the ones on screen.
    for old in session.exec(select(Alert).where(Alert.flight_id == flight.id, Alert.type == "DELAY_HOLD",
                                                Alert.status != "resolved")).all():
        _resolve(old, "feed", f"Superseded by a {minutes} min delay", clock.now(session=session))
        session.add(old)
    session.flush()
    alert = alerts.raise_alert(flight.id, "DELAY_HOLD", "warning", f"{flight.flight_no} delayed {minutes} min: hold meal dispatch",
                               body, deadline_at=dispatch, evidence={"delay_min": minutes, "std": flight.std.isoformat(),
                                                                     "etd": etd.isoformat(), "dispatch_at": dispatch.isoformat()},
                               session=session)
    outbox.notify("caterer", "caterer", alert.title, body, ref={"alert_id": alert.id}, session=session)
    changes = [{"kind": "changed", "passenger_id": None, "pnr": None, "name": flight.flight_no, "field": f,
                "before": before[f], "after": getattr(flight, f)} for f in before if before[f] != getattr(flight, f)]
    return {"message": None, "changes": changes, "alerts": [alert]}


def ssr_draft(flight: Flight, p: Passenger, code: str, note: str | None) -> str:
    """The SSR line staff would key in to request the meal again."""
    airline, number = flight.flight_no[:2], int(flight.flight_no[2:])
    day = ddmmm(date.fromisoformat(flight.date))
    return f"SSR {code} {airline} HK1 {flight.origin}{flight.dest}{number:04d}{p.cabin}{day}-1{p.surname}/{p.given}{p.title}" \
        + (f".{note}" if note else "")
