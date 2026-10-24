"""m21 endpoints: the sun at the aircraft for a flight or any route, the published departures, and the seats it moves."""
from datetime import date, datetime
from typing import Annotated, Any

from fastapi import APIRouter, HTTPException, Query
from pydantic import StringConstraints
from sqlmodel import Session

from app.core.db import SessionDep
from app.core.models import Flight
from app.modules.m21_sun import service

router = APIRouter(prefix="/api/sun", tags=["m21 · sun at the aircraft"])

Id = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=40)]
AirportCode = Annotated[str, StringConstraints(strip_whitespace=True, to_upper=True, pattern=r"^[A-Za-z]{3}$")]
FlightNo = Annotated[str, StringConstraints(strip_whitespace=True, to_upper=True, max_length=8, pattern=r"^[A-Za-z0-9]*$")]
IsoTime = Annotated[str, StringConstraints(strip_whitespace=True, min_length=16, max_length=40)]
IsoDate = Annotated[str, StringConstraints(pattern=r"^\d{4}-\d{2}-\d{2}$")]

MIN_YEAR, MAX_YEAR = 1950, 2100  # where the solar formulas stay well inside their accuracy


def _flight(session: Session, flight_id: str) -> Flight:
    flight = session.get(Flight, flight_id)
    if flight is None:
        raise HTTPException(status_code=404, detail=f"No flight {flight_id}")
    return flight


def _time(value: str, name: str) -> datetime:
    try:
        at = datetime.fromisoformat(value.replace(" ", "+"))  # an unencoded "+" in a query arrives as a space
    except ValueError:
        raise HTTPException(status_code=422, detail=f"{name} must be an ISO time, e.g. 2026-10-25T04:35:00+05:30") from None
    if at.tzinfo is None:
        raise HTTPException(status_code=422, detail=f"{name} must carry an offset, e.g. +05:30")
    return at


@router.get("/flight/{flight_id}")
def flight_sun(flight_id: Id, session: SessionDep) -> dict[str, Any]:
    flight = _flight(session, flight_id)
    dep, arr = service.flight_times(flight)
    out = service.summary(flight.origin, flight.dest, dep, arr, flight_id=flight.id, flight_no=flight.flight_no)
    return {**out, "delay_min": flight.delay_min}


@router.get("/route")
def route_sun(
    origin: Annotated[AirportCode, Query(alias="from")],
    dest: Annotated[AirportCode, Query(alias="to")],
    dep: IsoTime,
    arr: IsoTime,
    flight_no: FlightNo = "",
) -> dict[str, Any]:
    try:
        return service.summary(origin, dest, _time(dep, "dep"), _time(arr, "arr"), flight_no=flight_no or None)
    except service.RouteError as err:
        raise HTTPException(status_code=422, detail=str(err)) from None


@router.get("/presets")
def presets(day: Annotated[IsoDate, Query(alias="date")] = service.PRESET_DATE) -> dict[str, Any]:
    try:
        when = date.fromisoformat(day)
    except ValueError:
        raise HTTPException(status_code=422, detail=f"Not a calendar date: {day}") from None
    if not MIN_YEAR <= when.year <= MAX_YEAR:
        raise HTTPException(status_code=422, detail=f"Pick a date from {MIN_YEAR} to {MAX_YEAR}")
    return {"date": when.isoformat(), "rule": service.CHAUVIHAR, "flights": service.presets(when)}


@router.get("/seats/{flight_id}")
def seats(flight_id: Id, session: SessionDep) -> dict[str, Any]:
    flight = _flight(session, flight_id)
    return {"flight_id": flight.id, "seats": service.daylight_seats(session, flight.id)}
