from typing import Any

from fastapi import APIRouter, HTTPException

from app.core.db import SessionDep
from app.core.models import Flight
from app.modules.m8_crew.events import CrewEventsIn, apply_events
from app.modules.m8_crew.package import build_package

router = APIRouter(prefix="/api", tags=["m8 · crew tablet"])


def _flight(session, flight_id: str) -> Flight:
    flight = session.get(Flight, flight_id)
    if not flight:
        raise HTTPException(404, f"No flight {flight_id}")
    return flight


@router.get("/flights/{flight_id}/crew-package")
def crew_package(flight_id: str, session: SessionDep) -> dict[str, Any]:
    return build_package(session, _flight(session, flight_id))


@router.post("/flights/{flight_id}/crew-events")
def crew_events(flight_id: str, body: CrewEventsIn, session: SessionDep) -> dict[str, int]:
    flight = _flight(session, flight_id)
    try:
        result = apply_events(session, flight, body)
    except ValueError as e:
        session.rollback()
        raise HTTPException(422, str(e)) from e
    session.commit()
    return result
