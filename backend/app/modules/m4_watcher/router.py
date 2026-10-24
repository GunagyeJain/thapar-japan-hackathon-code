from typing import Any, Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlmodel import select

from app.core import clock, outbox
from app.core.db import SessionDep
from app.core.models import Alert, Flight, MealPromise, Passenger, RawMessage

from .watcher import display_name, ingest, simulate, ssr_draft

router = APIRouter(prefix="/api", tags=["m4 · lost-meal watcher"])


class FeedIn(BaseModel):
    text: str


class ActionIn(BaseModel):
    action: Literal["acknowledge", "request_again", "notify_passenger", "notify_kitchen", "resolve"]
    actor: str
    note: str | None = None


class BookingEventIn(BaseModel):
    type: Literal["rebook_drop_meal", "restore_meal", "seat_change", "delay"]
    passenger_id: str | None = None
    params: dict[str, Any] = {}


def _bad_request(fn, *args, **kwargs):
    try:
        return fn(*args, **kwargs)
    except ValueError as e:
        raise HTTPException(400, str(e)) from e


@router.post("/feed/messages")
def feed_message(body: FeedIn, session: SessionDep) -> dict[str, Any]:
    result = _bad_request(ingest, body.text, session=session)
    session.commit()
    return result


@router.get("/flights/{flight_id}/messages")
def list_messages(flight_id: str, session: SessionDep) -> list[RawMessage]:
    return list(session.exec(select(RawMessage).where(RawMessage.flight_id == flight_id).order_by(RawMessage.seq)).all())


@router.get("/flights/{flight_id}/manifest")
def manifest(flight_id: str, session: SessionDep) -> dict[str, Any]:
    """Current booking state as last seen in the feed. Judges join outside the feed, so they're not listed."""
    if not session.get(Flight, flight_id):
        raise HTTPException(404, f"No flight {flight_id}")
    last = session.exec(select(RawMessage.id).where(RawMessage.flight_id == flight_id).order_by(RawMessage.seq.desc())).first()  # type: ignore[attr-defined]
    rows = session.exec(select(Passenger).where(Passenger.flight_id == flight_id, Passenger.is_judge == False)).all()  # noqa: E712
    return {"as_of": last, "passengers": [
        {"passenger_id": p.id, "pnr": p.pnr, "surname": p.surname, "given": p.given, "title": p.title, "seat": p.seat,
         "cabin": p.cabin, "ssr": [{"code": p.ssr_meal, "status": "HK1", "text": p.ssr_note or ""}] if p.ssr_meal else [],
         "inbound": p.inbound}
        for p in sorted(rows, key=lambda p: (int(p.seat[:-1]), p.seat[-1]))]}


@router.get("/alerts")
def list_alerts(session: SessionDep, flight_id: str | None = None, status: str | None = None,
                type: str | None = None) -> list[Alert]:  # noqa: A002 - contract name
    query = select(Alert).order_by(Alert.created_at.desc())  # type: ignore[attr-defined]
    if flight_id:
        query = query.where(Alert.flight_id == flight_id)
    if status:
        query = query.where(Alert.status == status)
    if type:
        query = query.where(Alert.type == type)
    return list(session.exec(query).all())


@router.post("/alerts/{alert_id}/actions")
def alert_action(alert_id: str, body: ActionIn, session: SessionDep) -> Alert:
    alert = session.get(Alert, alert_id)
    if not alert:
        raise HTTPException(404, f"No alert {alert_id}")
    if alert.status == "resolved":
        raise HTTPException(409, f"Alert {alert_id} is already resolved")
    now = clock.now(session=session)
    alert.actions = [*alert.actions, {"action": body.action, "actor": body.actor, "at": now.isoformat(), "note": body.note}]
    p = session.get(Passenger, alert.passenger_id) if alert.passenger_id else None
    flight = session.get(Flight, alert.flight_id)

    if body.action == "acknowledge":
        alert.status = "acknowledged"
    elif body.action == "resolve":
        alert.status = "resolved"
    elif body.action == "notify_passenger":
        if not p:
            raise HTTPException(400, "This alert has no passenger")
        outbox.notify("sms", p.id, alert.title, body.note or alert.body, ref={"alert_id": alert.id}, session=session)
    elif body.action == "notify_kitchen":
        outbox.notify("caterer", "caterer", f"{flight.flight_no}: {alert.title}", body.note or alert.body,
                      ref={"alert_id": alert.id}, session=session)
    elif body.action == "request_again":
        if not p:
            raise HTTPException(400, "This alert has no passenger")
        ev = alert.evidence
        promise = session.get(MealPromise, alert.promise_id) if alert.promise_id else None
        code = ev.get("code_before") or ev.get("suggested_code") or (promise.code if promise else None)
        note = ev.get("note_before") or (promise.kitchen_note if promise else None)
        if not code:
            raise HTTPException(400, f"No meal code to request again for {display_name(p)}")
        alert.evidence = {**ev, "ssr_draft": ssr_draft(flight, p, code, note)}
        session.add(alert)
        # The agent keys in the SSR; the corrected ADL comes back through the feed and resolves the alert.
        _bad_request(simulate, "restore_meal", p.id, session=session, code=code, note=note)
    session.add(alert)
    session.commit()
    session.refresh(alert)
    return alert


@router.post("/sim/booking-events")
def booking_event(body: BookingEventIn, session: SessionDep) -> dict[str, Any]:
    result = _bad_request(simulate, body.type, body.passenger_id, session=session, **body.params)
    session.commit()
    return {"message": result["message"], "alerts": result["alerts"], "changes": result["changes"]}
