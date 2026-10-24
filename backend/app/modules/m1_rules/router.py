"""m1 endpoints: the rules data, evaluate, code options and the booking check."""

from typing import Annotated

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, StringConstraints, model_validator

from app.core.db import SessionDep
from app.core.models import MealSpec, Profile

from . import engine

router = APIRouter(prefix="/api", tags=["m1 · rules engine"])

Word = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=64)]
Words = Annotated[list[Word], Field(max_length=200)]


class EvaluateIn(BaseModel):
    forbid: Words | None = None
    spec_tags: Words | None = None
    profile_id: Word | None = None
    spec_id: Word | None = None

    @model_validator(mode="after")
    def one_form(self):
        by_tags = self.forbid is not None and self.spec_tags is not None
        by_ids = self.profile_id is not None and self.spec_id is not None
        if by_tags == by_ids:
            raise ValueError("Send either {forbid, spec_tags} or {profile_id, spec_id}")
        return self


class CodeOptionsIn(BaseModel):
    forbid: Words
    allow: Words = []


class CheckBookingIn(BaseModel):
    forbid: Words
    booked_code: Annotated[str, StringConstraints(strip_whitespace=True, max_length=8)] | None = None


def _run(fn, *args):
    try:
        return fn(*args)
    except engine.UnknownTagError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/rules")
def get_rules():
    return engine.rules_payload()


@router.post("/rules/evaluate")
def post_evaluate(body: EvaluateIn, session: SessionDep):
    if body.profile_id is None:
        return _run(engine.evaluate, body.forbid, body.spec_tags)
    profile = session.get(Profile, body.profile_id)
    spec = session.get(MealSpec, body.spec_id)
    if profile is None or spec is None:
        missing = body.profile_id if profile is None else body.spec_id
        raise HTTPException(status_code=404, detail=f"Not found: {missing}")
    return _run(engine.evaluate, profile.forbid, engine.spec_tags(spec.tags, spec.certified))


@router.post("/rules/code-options")
def post_code_options(body: CodeOptionsIn):
    return {"options": _run(engine.code_options, body.forbid, body.allow)}


@router.post("/rules/check-booking")
def post_check_booking(body: CheckBookingIn):
    return _run(engine.check_booking, body.forbid, body.booked_code)
