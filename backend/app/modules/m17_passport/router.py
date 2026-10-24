"""m17 endpoints: a passenger's passport and what the cabin has told us. The chat, Radar and save endpoints come next."""
from typing import Any

from fastapi import APIRouter, HTTPException

from app.core.db import SessionDep
from app.core.models import Flight, Passenger
from app.modules.m17_passport import service

router = APIRouter(prefix="/api/passport", tags=["m17 · dietary passport"])


@router.get("/cabin/{flight_id}")
def cabin(flight_id: str, session: SessionDep) -> dict[str, Any]:
    if session.get(Flight, flight_id) is None:
        raise HTTPException(status_code=404, detail=f"No flight {flight_id}")
    rows = service.cabin(session, flight_id)
    return {
        "flight_id": flight_id,
        "known": sum(r["known"] for r in rows),
        "total": len(rows),
        "passengers": [{**r, "card": service.rules_card(r["rules"])} for r in rows],
    }


@router.get("/{passenger_id}")
def get_passport(passenger_id: str, session: SessionDep) -> dict[str, Any]:
    pax = session.get(Passenger, passenger_id)
    if pax is None:
        raise HTTPException(status_code=404, detail=f"No passenger {passenger_id}")
    passport = service.get(session, passenger_id)
    if passport is None:
        raise HTTPException(status_code=404, detail=f"No passport for {passenger_id}")
    return {**passport.model_dump(), "card": service.rules_card(passport.rules),
            "plan": service.plan_for(session, pax, passport.rules)}
