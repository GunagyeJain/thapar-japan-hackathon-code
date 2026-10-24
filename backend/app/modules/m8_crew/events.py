"""Applies crew events synced from the tablet: C4 (galley), C5 (seat scan), swaps and alerts."""
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, field_validator
from sqlmodel import Session, select

from app.core import alerts, clock, events, outbox
from app.core.models import Alert, Flight, MealItem, MealPromise, MealSpec, Passenger
from app.core.settings import seed_epoch
from app.modules.m8_crew.models import CrewEventLog

EventType = Literal["galley_found", "galley_missing", "seat_scan", "swap_backup"]
SOURCE = "crew tablet"


class CrewEvent(BaseModel):
    client_id: str
    type: EventType
    item_id: str | None = None
    passenger_id: str | None = None
    seat: str | None = None
    verdict: Literal["SAFE", "UNSAFE", "NEEDS_HUMAN"] | None = None
    reason: str | None = None
    at: datetime
    wall_at: datetime | None = None  # the device's real clock; the server turns it into sim time

    @field_validator("at")
    @classmethod
    def needs_offset(cls, v: datetime) -> datetime:
        if v.tzinfo is None:
            raise ValueError("at needs an offset")
        return v


class CrewEventsIn(BaseModel):
    seed_epoch: int
    events: list[CrewEvent]


def _promise(session: Session, passenger_id: str | None) -> MealPromise | None:
    if not passenger_id:
        return None
    return session.exec(select(MealPromise).where(MealPromise.passenger_id == passenger_id)).first()


def _spec_name(session: Session, item: MealItem) -> str:
    spec = session.get(MealSpec, item.spec_id)
    return spec.name.get("en", item.spec_id) if spec else item.spec_id


def _checkpoint(session, flight, passenger_id, checkpoint, result, detail, ev: CrewEvent, data=None) -> None:
    if not passenger_id:
        return
    promise = _promise(session, passenger_id)
    events.record_checkpoint(
        promise.id if promise else None, passenger_id, flight.id, checkpoint, result, SOURCE, detail,
        data=data or {}, key=f"crew:{ev.client_id}", at=ev.at, session=session,
    )


def _galley_found(session: Session, flight: Flight, ev: CrewEvent, item: MealItem) -> None:
    item.status = "loaded"
    session.add(item)
    _checkpoint(session, flight, item.assigned_passenger_id, "C4", "ok",
                f"Tray {item.id} found in galley {item.galley[-1]}", ev, {"item_id": item.id})


def _galley_missing(session: Session, flight: Flight, ev: CrewEvent, item: MealItem) -> None:
    item.status = "missing"
    session.add(item)
    pax = session.get(Passenger, item.assigned_passenger_id) if item.assigned_passenger_id else None
    seat = pax.seat if pax else "?"
    _checkpoint(session, flight, item.assigned_passenger_id, "C4", "fail",
                f"{seat}: tray {item.id} not found in galley {item.galley[-1]}", ev, {"item_id": item.id})
    promise = _promise(session, item.assigned_passenger_id)
    alerts.raise_alert(
        flight.id, "MISSING_TRAY", "warning", f"{seat}: special meal missing in galley",
        f"{_spec_name(session, item)} ({item.id}) was not found at {item.position}.",
        passenger_id=item.assigned_passenger_id, promise_id=promise.id if promise else None,
        evidence={"item_id": item.id, "galley": item.galley, "position": item.position}, session=session,
    )


def _swap_backup(session: Session, flight: Flight, ev: CrewEvent, backup: MealItem) -> None:
    pid = ev.passenger_id
    if not pid:
        raise ValueError("swap_backup needs passenger_id")
    for original in session.exec(
        select(MealItem).where(MealItem.assigned_passenger_id == pid, MealItem.kind == "special")
    ).all():
        if original.id != backup.id:
            original.status = "missing"
            session.add(original)
    backup.assigned_passenger_id = pid
    backup.status = "loaded"
    session.add(backup)
    pax = session.get(Passenger, pid)
    seat = pax.seat if pax else pid
    _checkpoint(session, flight, pid, "C4", "fixed",
                f"{seat}: backup {backup.id} from galley {backup.galley[-1]} assigned", ev, {"item_id": backup.id})
    now = clock.now(session=session)
    for alert in session.exec(
        select(Alert).where(Alert.type == "MISSING_TRAY", Alert.passenger_id == pid, Alert.status != "resolved")
    ).all():
        alert.status = "resolved"
        alert.actions = [*alert.actions, {"action": "resolve", "actor": "crew", "at": now.isoformat(),
                                          "note": f"Backup {backup.id} assigned"}]
        session.add(alert)


def _seat_scan(session: Session, flight: Flight, ev: CrewEvent, item: MealItem) -> None:
    pax = session.exec(select(Passenger).where(Passenger.flight_id == flight.id, Passenger.seat == ev.seat)).first() \
        if ev.seat else session.get(Passenger, ev.passenger_id or "")
    if not pax:
        raise ValueError(f"no passenger at seat {ev.seat}")
    verdict = ev.verdict or "NEEDS_HUMAN"
    if verdict == "SAFE":
        item.status = "served"
        session.add(item)
        _checkpoint(session, flight, pax.id, "C5", "ok", f"{pax.seat}: tray {item.id} scanned green", ev,
                    {"item_id": item.id})
        return
    reason = ev.reason or _spec_name(session, item)
    _checkpoint(session, flight, pax.id, "C5", "info", f"{pax.seat}: wrong tray {item.id} caught · {reason}", ev,
                {"item_id": item.id, "verdict": verdict})
    promise = _promise(session, pax.id)
    alerts.raise_alert(
        flight.id, "RED_SCAN", "warning", f"{pax.seat}: wrong tray caught before serving",
        f"{_spec_name(session, item)} ({item.id}) · {reason}",
        passenger_id=pax.id, promise_id=promise.id if promise else None,
        evidence={"item_id": item.id, "verdict": verdict, "seat": pax.seat}, session=session,
    )
    outbox.notify("crew", f"crew:{flight.flight_no}", f"{pax.seat}: wrong tray caught",
                  f"{item.id} is not safe for {pax.seat}: {reason}", session=session)


HANDLERS = {"galley_found": _galley_found, "galley_missing": _galley_missing,
            "swap_backup": _swap_backup, "seat_scan": _seat_scan}


def apply_events(session: Session, flight: Flight, body: CrewEventsIn) -> dict[str, int]:
    if body.seed_epoch < seed_epoch(session=session):
        return {"accepted": 0, "duplicates": 0, "ignored_old_epoch": len(body.events)}
    accepted = duplicates = 0
    for ev in sorted(body.events, key=lambda e: e.at):
        if session.get(CrewEventLog, ev.client_id):
            duplicates += 1
            continue
        item = session.get(MealItem, ev.item_id) if ev.item_id else None
        if not item or item.flight_id != flight.id:
            raise ValueError(f"unknown item {ev.item_id} for {flight.id}")
        if ev.wall_at and ev.wall_at.tzinfo:
            # The tablet's own sim time is stale if the clock moved while it was offline.
            ev = ev.model_copy(update={"at": clock.at_wall(ev.wall_at, session=session)})
        HANDLERS[ev.type](session, flight, ev, item)
        session.add(CrewEventLog(client_id=ev.client_id, flight_id=flight.id, seed_epoch=body.seed_epoch,
                                 type=ev.type, at=ev.at, payload=ev.model_dump(mode="json")))
        session.flush()
        accepted += 1
    return {"accepted": accepted, "duplicates": duplicates, "ignored_old_epoch": 0}
