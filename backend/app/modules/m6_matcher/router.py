"""m6 endpoints: inventory, dry-run match, late requests, backup forecast."""
from datetime import date
from typing import Annotated, Literal

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field, StringConstraints
from sqlmodel import select

from app.core.db import SessionDep
from app.core.models import Flight
from app.modules.m1_rules.engine import UnknownTagError
from app.modules.m6_matcher import forecast, inventory, matcher
from app.modules.m6_matcher.models import LateRequest

router = APIRouter(prefix="/api", tags=["m6 · late-request matcher"])

Id = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=40)]
Tag = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=64)]
Tags = Annotated[list[Tag], Field(max_length=100)]


class MatchIn(BaseModel):
    flight_id: Id
    passenger_id: Id | None = None
    forbid: Tags
    allow: Tags = []
    source: Literal["checkin", "gate", "crew", "join"] = "gate"


def _flight(session, flight_id: str) -> None:
    if session.get(Flight, flight_id) is None:
        raise HTTPException(status_code=404, detail=f"No flight {flight_id}")


def _late_payload(lr: LateRequest) -> dict:
    return {
        "late_request": {"id": lr.id, "passenger_id": lr.passenger_id, "at": lr.at, "source": lr.source, "status": lr.status},
        "match": lr.match,
    }


@router.get("/flights/{flight_id}/inventory")
def get_inventory(flight_id: str, session: SessionDep):
    _flight(session, flight_id)
    return inventory.inventory_payload(inventory.load(session, flight_id))


@router.post("/match")
def post_match(body: MatchIn, session: SessionDep):
    _flight(session, body.flight_id)
    try:
        return matcher.match(session, body.flight_id, body.forbid, body.allow, body.passenger_id, body.source)
    except UnknownTagError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/late-requests")
def post_late_request(body: MatchIn, session: SessionDep):
    if not body.passenger_id:
        raise HTTPException(status_code=422, detail="passenger_id is required for a late request")
    _flight(session, body.flight_id)
    try:
        lr = matcher.reserve(session, body.flight_id, body.passenger_id, body.forbid, body.allow, body.source)
    except UnknownTagError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    session.commit()
    return _late_payload(lr)


@router.get("/late-requests/{late_request_id}")
def get_late_request(late_request_id: str, session: SessionDep):
    lr = session.get(LateRequest, late_request_id)
    if lr is None:
        raise HTTPException(status_code=404, detail=f"No late request {late_request_id}")
    return _late_payload(lr)


@router.get("/backups/forecast")
def get_backup_forecast(
    session: SessionDep,
    flight_no: Annotated[str, Query(pattern=r"^[A-Z0-9]{2,8}$")] = "JL740",
    days: Annotated[int, Query(ge=1, le=60)] = 14,
):
    """Recommended sealed backups per day, starting from the next flight with this number."""
    first = session.exec(select(Flight).where(Flight.flight_no == flight_no).order_by(Flight.date)).first()
    if first is None:
        raise HTTPException(status_code=404, detail=f"No flight {flight_no}")
    start = date.fromisoformat(str(first.date))
    return {"flight_no": flight_no, **forecast.forecast(start, days)}
