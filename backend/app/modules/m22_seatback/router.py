"""m22 endpoints: the crew ask the seats, each seat screen reads its question and answers it."""
from typing import Annotated, Any, Literal

from fastapi import APIRouter, HTTPException, Path
from pydantic import BaseModel, StringConstraints

from app.core.db import SessionDep
from app.modules.m22_seatback import service

router = APIRouter(prefix="/api", tags=["m22 · seatback meal check"])

SEAT_PATTERN = r"^\d{1,2}[A-K]$"
FlightId = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=40)]
Seat = Annotated[str, StringConstraints(strip_whitespace=True, to_upper=True, pattern=SEAT_PATTERN)]
SeatPath = Annotated[str, Path(pattern=SEAT_PATTERN)]


class AskIn(BaseModel):
    flight_id: FlightId


class AnswerIn(BaseModel):
    flight_id: FlightId
    seat: Seat
    answer: Literal["yes", "no", "change"]
    item_id: Annotated[str, StringConstraints(strip_whitespace=True, max_length=20)] | None = None


def _run(fn, *args: Any) -> dict[str, Any]:
    try:
        return fn(*args)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except service.NotAsked as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.post("/seatback/ask")
def post_ask(body: AskIn, session: SessionDep) -> dict[str, Any]:
    out = _run(service.ask, session, body.flight_id)
    session.commit()
    return out


@router.get("/seatback/{flight_id}")
def get_status(flight_id: str, session: SessionDep) -> dict[str, Any]:
    return _run(service.status, session, flight_id)


@router.get("/seatback/{flight_id}/seats/{seat}")
def get_seat(flight_id: str, seat: SeatPath, session: SessionDep) -> dict[str, Any]:
    return _run(service.seat_view, session, flight_id, seat)


@router.get("/seatback/{flight_id}/seats/{seat}/options")
def get_options(flight_id: str, seat: SeatPath, session: SessionDep) -> dict[str, Any]:
    return _run(service.options, session, flight_id, seat)


@router.post("/seatback/answer")
def post_answer(body: AnswerIn, session: SessionDep) -> dict[str, Any]:
    out = _run(service.answer, session, body.flight_id, body.seat, body.answer, body.item_id)
    session.commit()
    return out
