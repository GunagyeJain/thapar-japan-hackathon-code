"""m16 endpoints: a passenger's legs with the meal on each date, saving fast days, the ops list ahead."""
from datetime import date, timedelta
from typing import Annotated, Any

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field, StringConstraints
from sqlmodel import Session, select

from app.core import clock
from app.core.db import SessionDep
from app.core.models import Passenger, Profile
from app.modules.m1_rules import engine
from app.modules.m3_passenger.options import meal_options
from app.modules.m16_days.models import TripLeg

router = APIRouter(prefix="/api/days", tags=["m16 · diets that change by date"])

Id = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=40)]
IsoDate = Annotated[str, StringConstraints(pattern=r"^\d{4}-\d{2}-\d{2}$")]


class SaveIn(BaseModel):
    passenger_id: Id
    fast_dates: Annotated[list[IsoDate], Field(max_length=20)] = []


def _profile(session: Session, passenger_id: str) -> Profile | None:
    rows = session.exec(select(Profile).where(Profile.passenger_id == passenger_id)).all()
    return max(rows, key=lambda p: p.created_at) if rows else None


def _ja_note(option: dict[str, Any]) -> str | None:
    """The kitchen note for a Tokyo caterer: the same tags, in Japanese."""
    if option["safety_gaps"]:
        tags = engine.rules().tags
        return "・".join(tags[t]["labels"].get("ja", t) for t in option["safety_gaps"]) + "不使用"
    return option["label_mark"].get("ja") if option["kitchen_note"] else None


def _meal(forbid: list[str], allow: list[str]) -> dict[str, Any]:
    best = meal_options(forbid, allow)[0]
    return {"code": best["code"], "kitchen_note": best["kitchen_note"], "kitchen_note_ja": _ja_note(best),
            "label_mark": best["label_mark"]}


def leg_payload(leg: TripLeg, profile: Profile | None) -> dict[str, Any]:
    out: dict[str, Any] = {"flight_no": leg.flight_no, "date": leg.date, "from": leg.origin, "to": leg.dest,
                           "catered_in": leg.catered_in, "fast_day": leg.fast_day}
    if profile is None:
        return {**out, "code": None, "kitchen_note": None, "kitchen_note_ja": None, "label_mark": None, "usual": None}
    usual = _meal(profile.forbid, profile.allow)
    on_day = engine.rules_on(profile.forbid, profile.allow, [leg.date] if leg.fast_day else [], leg.date)
    meal = _meal(on_day["forbid"], on_day["allow"]) if leg.fast_day else usual
    return {**out, **meal, "usual": {"code": usual["code"], "kitchen_note": usual["kitchen_note"]}}


def _legs(session: Session, passenger_id: str) -> list[TripLeg]:
    return list(session.exec(select(TripLeg).where(TripLeg.passenger_id == passenger_id).order_by(TripLeg.date)).all())


def _trips(session: Session, passenger_id: str) -> dict[str, Any]:
    if session.get(Passenger, passenger_id) is None:
        raise HTTPException(status_code=404, detail=f"No passenger {passenger_id}")
    profile = _profile(session, passenger_id)
    return {"passenger_id": passenger_id, "has_profile": profile is not None,
            "legs": [leg_payload(leg, profile) for leg in _legs(session, passenger_id)]}


@router.get("/trips")
def trips(passenger_id: Annotated[Id, Query()], session: SessionDep) -> dict[str, Any]:
    return _trips(session, passenger_id)


@router.post("/save")
def save(body: SaveIn, session: SessionDep) -> dict[str, Any]:
    legs = _legs(session, body.passenger_id)
    if session.get(Passenger, body.passenger_id) is None:
        raise HTTPException(status_code=404, detail=f"No passenger {body.passenger_id}")
    own = {leg.date for leg in legs}
    stray = sorted(set(body.fast_dates) - own)
    if stray:
        raise HTTPException(status_code=422, detail=f"Not one of this passenger's flight dates: {', '.join(stray)}")
    for leg in legs:
        leg.fast_day = leg.date in body.fast_dates
        session.add(leg)
    session.commit()
    return _trips(session, body.passenger_id)


@router.get("/ahead")
def ahead(session: SessionDep, days: Annotated[int, Query(ge=1, le=120)] = 30) -> dict[str, Any]:
    today = clock.now(session=session).date()
    until = (today + timedelta(days=days)).isoformat()
    legs = session.exec(
        select(TripLeg).where(TripLeg.fast_day, TripLeg.date >= today.isoformat(), TripLeg.date <= until)
        .order_by(TripLeg.date, TripLeg.passenger_id)
    ).all()
    out = []
    for leg in legs:
        pax = session.get(Passenger, leg.passenger_id)
        if pax is None:
            continue
        row = leg_payload(leg, _profile(session, leg.passenger_id))
        out.append({**row, "passenger_id": pax.id, "seat": pax.seat,
                    "name": f"{pax.given.title()} {pax.surname.title()}",
                    "days_to_go": (date.fromisoformat(leg.date) - today).days})
    return {"today": today.isoformat(), "legs": out}
