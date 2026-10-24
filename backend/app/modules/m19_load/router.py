"""m19 endpoint: the smart-load plan for one flight."""
from typing import Any

from fastapi import APIRouter, HTTPException

from app.core.db import SessionDep
from app.core.models import Flight
from app.modules.m19_load.service import load_plan

router = APIRouter(prefix="/api/load", tags=["m19 · smart load"])


@router.get("/{flight_id}")
def get_load(flight_id: str, session: SessionDep) -> dict[str, Any]:
    flight = session.get(Flight, flight_id)
    if flight is None:
        raise HTTPException(status_code=404, detail=f"No flight {flight_id}")
    return load_plan(session, flight)
