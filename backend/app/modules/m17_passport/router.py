"""m17 endpoints: understand a diet in the passenger's own words, save the passport, the booking's other travellers,
what the cabin has told us, and the Calendar Radar (scan, answer)."""
from typing import Annotated, Any, Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict, Field, StringConstraints
from sqlmodel import select

from app.core.db import SessionDep
from app.core.models import Flight, Passenger
from app.modules.m1_rules import engine
from app.modules.m17_passport import radar, service
from app.modules.m17_passport.understand import clean_time_rule, understand

router = APIRouter(prefix="/api", tags=["m17 · dietary passport"])

Id = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=40)]
TagId = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=40)]
IsoDate = Annotated[str, StringConstraints(pattern=r"^\d{4}-\d{2}-\d{2}$")]
Tier = Literal["hard", "firm", "soft"]


class UnderstandIn(BaseModel):
    text: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=500)]
    lang: Annotated[str, StringConstraints(pattern=r"^[a-z]{2}(-[A-Za-z]{2})?$")] | None = None


class TimeRuleIn(BaseModel):
    model_config = ConfigDict(extra="ignore")  # the phone's label and via are dropped here

    id: Annotated[str, StringConstraints(max_length=16)] | None = None
    kind: Literal["dates", "weekday", "daylight", "dawn_to_sunset"]
    dates: Annotated[list[IsoDate], Field(max_length=400)] = []
    weekdays: Annotated[list[Annotated[int, Field(ge=0, le=6)]], Field(max_length=7)] = []
    preset: Literal["vrat", "vegetarian"] | None = None
    add_forbid: Annotated[list[TagId], Field(max_length=40)] = []
    after_sunrise_min: Annotated[int, Field(ge=0, le=180)] | None = None
    confirm: bool = False
    confirmed: Annotated[list[IsoDate], Field(max_length=400)] = []
    declined: Annotated[list[IsoDate], Field(max_length=400)] = []


class RulesIn(BaseModel):
    forbid: Annotated[list[TagId], Field(max_length=200)] = []
    allow: Annotated[list[TagId], Field(max_length=200)] = []
    allergens: Annotated[list[TagId], Field(max_length=60)] = []
    tiers: dict[TagId, Tier] = {}
    flex: bool = False
    time_rules: Annotated[list[TimeRuleIn], Field(max_length=12)] = []


class PassportIn(BaseModel):
    passenger_id: Id
    lang: Literal["en", "hi", "ja"] = "en"
    rules: RulesIn
    source: Literal["chat", "form", "desk", "ssr", "seed"] = "chat"


class ScanIn(BaseModel):
    flight_id: Id | None = None
    passenger_id: Id | None = None


class AnswerIn(BaseModel):
    question_id: Id
    option_id: Literal["yes", "no"]


def _checked(tags: list[str]) -> list[str]:
    try:
        return engine.check_tags(tags)
    except engine.UnknownTagError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


def _time_rule(rule: TimeRuleIn, n: int) -> dict[str, Any]:
    """Only the fields a TimeRule of this kind carries; never a label."""
    out: dict[str, Any] = {"id": rule.id or f"TR-{n}", "kind": rule.kind}
    if rule.kind in ("dates", "dawn_to_sunset"):
        out["dates"] = sorted(set(rule.dates))
    if rule.kind == "weekday":
        out["weekdays"] = sorted(set(rule.weekdays))
    if rule.kind in ("dates", "weekday"):
        if rule.preset:
            out["preset"] = rule.preset
        if rule.add_forbid:
            out["add_forbid"] = _checked(rule.add_forbid)
    if rule.kind == "daylight":
        out["after_sunrise_min"] = rule.after_sunrise_min or 0
    if rule.confirm:
        out["confirm"] = True
    for name in ("confirmed", "declined"):
        if getattr(rule, name):
            out[name] = sorted(set(getattr(rule, name)))
    return clean_time_rule(out)


def stored_rules(body: RulesIn) -> dict[str, Any]:
    """The Rules a passport keeps: known tags only, allergies forbidden too, a tier for every forbid, no labels.

    Flex is only kept when nothing is hard: someone who never eats meat is never offered a swap.
    """
    allergens = _checked(body.allergens)
    forbid = _checked([*body.forbid, *allergens])
    allow = [a for a in _checked(body.allow) if not any(f in engine.rules().paths(a) for f in forbid)]
    tiers = {t: ("hard" if t in allergens else body.tiers.get(t) or service.tier_for(t, allergens)) for t in forbid}
    return {
        "forbid": forbid,
        "allow": allow,
        "allergens": allergens,
        "tiers": tiers,
        "flex": body.flex and "hard" not in tiers.values(),
        "time_rules": [_time_rule(r, i + 1) for i, r in enumerate(body.time_rules)],
    }


def _passenger(session, passenger_id: str) -> Passenger:
    pax = session.get(Passenger, passenger_id)
    if pax is None:
        raise HTTPException(status_code=404, detail=f"No passenger {passenger_id}")
    return pax


def _plan_out(session, plan: dict[str, Any]) -> dict[str, Any]:
    return {**plan, "main_pick_name": service.main_name(session, plan)}


@router.get("/passport/cabin/{flight_id}")
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


@router.post("/passport/understand")
def understand_text(body: UnderstandIn) -> dict[str, Any]:
    """The passenger's own words → food rules to check. Stores nothing and logs nothing."""
    return understand(body.text, body.lang)


@router.post("/passport")
def save_passport(body: PassportIn, session: SessionDep) -> dict[str, Any]:
    pax = _passenger(session, body.passenger_id)
    rules = stored_rules(body.rules)
    passport, plan, promise = service.save(session, pax, lang=body.lang, rules=rules, source=body.source)
    radar.scan(session, passenger_id=pax.id)  # the Radar's question arrives right away
    session.commit()
    return {"passport": passport.model_dump(), "plan": _plan_out(session, plan),
            "promise": promise.model_dump() if promise else None}


@router.get("/passport/booking/{passenger_id}")
def booking(passenger_id: str, session: SessionDep) -> dict[str, Any]:
    """The others on the same booking reference, so the chat can say "send them this link"."""
    pax = _passenger(session, passenger_id)
    others = session.exec(select(Passenger).where(Passenger.pnr == pax.pnr, Passenger.id != pax.id)).all()

    def row(p: Passenger) -> dict[str, Any]:
        return {"passenger_id": p.id, "name": f"{p.given.title()} {p.surname.title()}", "surname": p.surname,
                "seat": p.seat, "has_passport": service.get(session, p.id) is not None}

    flight = session.get(Flight, pax.flight_id)
    return {"pnr": pax.pnr, "flight_no": flight.flight_no if flight else None,
            "passenger": row(pax), "passengers": [row(p) for p in sorted(others, key=lambda p: p.seat)]}


@router.get("/passport/{passenger_id}")
def get_passport(passenger_id: str, session: SessionDep) -> dict[str, Any]:
    pax = _passenger(session, passenger_id)
    passport = service.get(session, passenger_id)
    if passport is None:
        raise HTTPException(status_code=404, detail=f"No passport for {passenger_id}")
    return {**passport.model_dump(), "card": service.rules_card(passport.rules),
            "plan": _plan_out(session, service.plan_for(session, pax, passport.rules))}


@router.post("/radar/scan")
def radar_scan(body: ScanIn, session: SessionDep) -> dict[str, Any]:
    if body.flight_id and session.get(Flight, body.flight_id) is None:
        raise HTTPException(status_code=404, detail=f"No flight {body.flight_id}")
    if body.passenger_id:
        _passenger(session, body.passenger_id)
    out = radar.scan(session, flight_id=body.flight_id, passenger_id=body.passenger_id)
    session.commit()
    return out


@router.post("/radar/answer")
def radar_answer(body: AnswerIn, session: SessionDep) -> dict[str, Any]:
    try:
        out = radar.answer(session, body.question_id, body.option_id)
    except radar.QuestionNotFound as exc:
        raise HTTPException(status_code=404, detail=f"No question {body.question_id}") from exc
    session.commit()
    return out
