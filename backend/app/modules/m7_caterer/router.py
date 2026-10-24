"""m7 endpoints: meal-list versions, acknowledge (C3), labels."""
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, StringConstraints
from sqlmodel import select

from app.core.db import SessionDep
from app.core.models import Flight
from app.modules.m7_caterer import service
from app.modules.m7_caterer.models import MealListVersion

router = APIRouter(prefix="/api", tags=["m7 · caterer"])


class AckIn(BaseModel):
    by: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)]


def _flight(session, flight_id: str) -> None:
    if session.get(Flight, flight_id) is None:
        raise HTTPException(status_code=404, detail=f"No flight {flight_id}")


@router.get("/flights/{flight_id}/meal-lists")
def get_meal_lists(flight_id: str, session: SessionDep) -> list[dict]:
    _flight(session, flight_id)
    versions = session.exec(
        select(MealListVersion).where(MealListVersion.flight_id == flight_id).order_by(MealListVersion.version.desc())  # type: ignore[attr-defined]
    ).all()
    return [service.version_payload(v) for v in versions]


@router.post("/flights/{flight_id}/meal-lists")
def post_meal_list(flight_id: str, session: SessionDep) -> dict:
    """Cut the next version from the current bookings (returns the latest if nothing changed)."""
    _flight(session, flight_id)
    version = service.cut_version(flight_id, session=session)
    session.commit()
    return service.version_payload(version)


@router.post("/meal-lists/{meal_list_id}/ack")
def post_ack(meal_list_id: str, body: AckIn, session: SessionDep) -> dict:
    try:
        version = service.ack(meal_list_id, body.by, session=session)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    session.commit()
    return service.version_payload(version)


@router.get("/flights/{flight_id}/labels")
def get_labels(flight_id: str, session: SessionDep, version: Annotated[int | None, Query(ge=1)] = None) -> list[dict]:
    _flight(session, flight_id)
    try:
        return service.labels(session, flight_id, version)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
