"""m0 endpoints: health, sim clock, flights, passengers, notifications, demo reset."""
from datetime import datetime
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, field_validator
from sqlmodel import func, select

from . import clock
from .db import SessionDep
from .models import Alert, Flight, MealPromise, Notification, Passenger
from .seed import reset

VERSION = "0.1.0"

router = APIRouter(prefix="/api", tags=["m0 · core"])


class ClockIn(BaseModel):
    now: datetime

    @field_validator("now")
    @classmethod
    def needs_offset(cls, v: datetime) -> datetime:
        if v.tzinfo is None:
            raise ValueError("time needs an offset, e.g. 2026-10-24T23:02:00+05:30")
        return v


class ResetIn(BaseModel):
    keep_judges: bool = True


def _flight_or_404(session, flight_id: str) -> Flight:
    flight = session.get(Flight, flight_id)
    if not flight:
        raise HTTPException(404, f"No flight {flight_id}")
    return flight


@router.get("/health")
def health() -> dict[str, Any]:
    return {"ok": True, "version": VERSION}


@router.get("/clock")
def get_clock(session: SessionDep) -> dict[str, Any]:
    return {"now": clock.now(session=session), "tz": clock.TZ_NAME}


@router.post("/clock")
def set_clock(body: ClockIn, session: SessionDep) -> dict[str, Any]:
    sim = clock.set(body.now, session=session)
    session.commit()
    return {"now": sim}


@router.get("/flights")
def list_flights(session: SessionDep) -> list[Flight]:
    return list(session.exec(select(Flight).order_by(Flight.std)).all())


@router.get("/flights/{flight_id}")
def get_flight(flight_id: str, session: SessionDep) -> dict[str, Any]:
    flight = _flight_or_404(session, flight_id)
    passengers = session.exec(
        select(func.count()).select_from(Passenger).where(Passenger.flight_id == flight_id)
    ).one()
    special = session.exec(
        select(func.count())
        .select_from(Passenger)
        .where(Passenger.flight_id == flight_id, Passenger.ssr_meal.is_not(None))  # type: ignore[union-attr]
    ).one()
    open_alerts = session.exec(
        select(func.count()).select_from(Alert).where(Alert.flight_id == flight_id, Alert.status == "open")
    ).one()
    return {
        **flight.model_dump(),
        "counts": {"passengers": passengers, "special_meals": special, "open_alerts": open_alerts},
    }


@router.get("/flights/{flight_id}/passengers")
def list_passengers(flight_id: str, session: SessionDep, with_promises: bool = False) -> list[dict[str, Any]]:
    _flight_or_404(session, flight_id)
    passengers = session.exec(select(Passenger).where(Passenger.flight_id == flight_id)).all()
    promises: dict[str, MealPromise] = {}
    if with_promises:
        rows = session.exec(select(MealPromise).where(MealPromise.flight_id == flight_id)).all()
        promises = {p.passenger_id: p for p in rows}
    out = []
    for p in sorted(passengers, key=lambda p: (int(p.seat[:-1]), p.seat[-1])):
        row = p.model_dump()
        if p.id in promises:
            row["promise"] = promises[p.id].model_dump()
        out.append(row)
    return out


@router.get("/notifications")
def list_notifications(session: SessionDep, to: str | None = None) -> list[Notification]:
    query = select(Notification).order_by(Notification.at.desc())  # type: ignore[attr-defined]
    if to:
        query = query.where(Notification.to == to)
    return list(session.exec(query.limit(200)).all())


@router.post("/demo/reset")
def demo_reset(body: ResetIn | None = None) -> dict[str, Any]:
    epoch = reset(keep_judges=body.keep_judges if body else True)
    return {"ok": True, "seed_epoch": epoch}


@router.get("/modules")
def list_modules() -> list[dict[str, Any]]:
    """Every registered module and the number of endpoints it serves."""
    from app.registry import MODULES

    return [{"id": m.id, "name": m.name, "routes": len(m.router.routes)} for m in MODULES]
