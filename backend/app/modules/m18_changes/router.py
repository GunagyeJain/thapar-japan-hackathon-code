"""m18 endpoints: submit a change, the change log, metrics against today, the onboard plan, Chaos Mode."""
from datetime import date
from typing import Annotated, Any, Literal

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field, StringConstraints, field_validator

from app.core.db import SessionDep
from app.core.models import Flight
from app.core.seed import reset
from app.modules.m1_rules import engine
from app.modules.m18_changes import chaos, service, views

router = APIRouter(prefix="/api", tags=["m18 · change router"])

Id = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=40)]
Tag = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=64)]
Tags = Annotated[list[Tag], Field(max_length=100)]
Channel = Literal["chat", "radar", "checkin", "lounge", "gate", "crew", "feed", "boarding"]
Kind = Literal["new_need", "mind_change", "lost_request", "family_member", "no_show", "calendar", "run_out"]


def _known(tags: list[str]) -> list[str]:
    return engine.check_tags(tags)  # UnknownTagError is a ValueError: pydantic answers 422


class TimeRuleIn(BaseModel):
    id: Annotated[str, StringConstraints(max_length=20)] = "TR-1"
    kind: Literal["dates", "weekday", "daylight", "dawn_to_sunset"]
    dates: Annotated[list[date], Field(max_length=60)] = []
    weekdays: Annotated[list[Annotated[int, Field(ge=0, le=6)]], Field(max_length=7)] = []
    preset: Literal["vrat", "vegetarian"] | None = None
    add_forbid: Tags = []
    after_sunrise_min: Annotated[int, Field(ge=0, le=180)] | None = None

    _tags = field_validator("add_forbid")(_known)


class RulesIn(BaseModel):
    forbid: Tags = []
    allow: Tags = []
    allergens: Tags = []
    tiers: dict[Tag, Literal["hard", "firm", "soft"]] = {}
    flex: bool = False
    time_rules: Annotated[list[TimeRuleIn], Field(max_length=10)] = []

    _tags = field_validator("forbid", "allow", "allergens")(_known)

    @field_validator("tiers")
    @classmethod
    def _tier_tags(cls, v: dict[str, str]) -> dict[str, str]:
        _known(list(v))
        return v

    def as_rules(self) -> dict[str, Any]:
        out = self.model_dump()
        out["time_rules"] = [{k: (([d.isoformat() for d in val]) if k == "dates" else val) for k, val in r.items()
                              if val not in (None, [])} for r in out["time_rules"]]
        return out


class ChangeIn(BaseModel):
    flight_id: Id
    passenger_id: Id | None = None
    channel: Channel
    kind: Kind
    rules: RulesIn | None = None
    note: Annotated[str, StringConstraints(strip_whitespace=True, max_length=300)] | None = None
    lang: Literal["en", "hi", "ja"] | None = None


class ChaosIn(BaseModel):
    flight_id: Id
    preset: Literal["jl740"] = "jl740"


class ChaosResetIn(BaseModel):
    flight_id: Id


def _flight(session, flight_id: str) -> Flight:
    flight = session.get(Flight, flight_id)
    if flight is None:
        raise HTTPException(status_code=404, detail=f"No flight {flight_id}")
    return flight


@router.post("/changes")
def post_change(body: ChangeIn, session: SessionDep) -> dict[str, Any]:
    try:
        event = service.submit_change(session, flight_id=body.flight_id, passenger_id=body.passenger_id,
                                      channel=body.channel, kind=body.kind,
                                      rules=body.rules.as_rules() if body.rules else None, note=body.note, lang=body.lang)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    session.commit()
    return service.event_payload(event)


@router.get("/changes")
def get_changes(session: SessionDep, flight_id: Annotated[str, Query(min_length=1, max_length=40)]) -> dict[str, Any]:
    return views.list_changes(session, _flight(session, flight_id))


@router.get("/changes/metrics")
def get_metrics(session: SessionDep, flight_id: Annotated[str, Query(min_length=1, max_length=40)]) -> dict[str, Any]:
    return views.metrics(session, _flight(session, flight_id))


@router.get("/changes/assignments")
def get_assignments(session: SessionDep, flight_id: Annotated[str, Query(min_length=1, max_length=40)]) -> dict[str, Any]:
    _flight(session, flight_id)
    return {"assignments": views.assignments(session, flight_id)}


@router.post("/chaos/run")
def post_chaos_run(body: ChaosIn, session: SessionDep) -> dict[str, Any]:
    _flight(session, body.flight_id)
    try:
        return chaos.run(session, body.flight_id, body.preset)
    except chaos.ChaosError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.post("/chaos/reset")
def post_chaos_reset(body: ChaosResetIn, session: SessionDep) -> dict[str, Any]:
    """Change events and every chaos side effect live in other modules' rows too (bookings, meals, alerts,
    messages), so this runs the demo reset (judges kept): a clean log and the seeded cabin."""
    _flight(session, body.flight_id)
    session.close()
    return {"ok": True, "seed_epoch": reset(keep_judges=True)}
