"""m3 endpoints: find a booking, save a passenger's food rules (C1), and let judges join JL740."""

import threading
from datetime import timedelta
from typing import Annotated, Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, StringConstraints
from sqlmodel import Session, select

from app.core import alerts, clock, events
from app.core.db import SessionDep
from app.core.ids import new_id
from app.core.models import Alert, Flight, MealItem, MealPromise, Passenger, Profile
from app.core.seed import FLIGHT_ID
from app.modules.m1_rules import engine

from .options import meal_options, profile_line
from .seats import NoSeatLeft, cabin_for, clean_pnr, clean_surname, next_judge_seat

router = APIRouter(prefix="/api", tags=["m3 · passenger + judge join"])

Word = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=64)]
Words = Annotated[list[Word], Field(max_length=200)]
Lang = Annotated[str, StringConstraints(pattern="^(en|hi|ja)$")]

# Judges joining at the same moment must not get the same seat.
_join_lock = threading.Lock()


class ConsentIn(BaseModel):
    this_trip: bool
    save_profile: bool = False
    share_with_caterer: bool = False
    cross_border_ack: bool = False


class ProfileIn(BaseModel):
    passenger_id: Word
    lang: Lang = "en"
    presets: Words = []  # accepted from older clients, never stored
    forbid: Words
    allow: Words = []
    fasting_dates: Words = []
    allergens: Words = []
    consent: ConsentIn
    chosen_code: Annotated[str, StringConstraints(strip_whitespace=True, to_upper=True, max_length=8)] | None = None


class JoinIn(BaseModel):
    display_name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=40)]
    lang: Lang = "en"
    presets: Words = []
    forbid: Words
    allow: Words = []
    allergens: Words = []
    consent: ConsentIn
    # A judge changing their answers: keep the same seat, release the meal reserved for the old answers.
    passenger_id: Word | None = None


class OptionsIn(BaseModel):
    forbid: Words
    allow: Words = []


def _engine(fn, *args):
    try:
        return fn(*args)
    except engine.UnknownTagError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


def _consent(consent: ConsentIn, session: Session) -> dict[str, Any]:
    if not consent.this_trip:
        raise HTTPException(status_code=400, detail="We need consent for this trip to order the meal")
    return {**consent.model_dump(), "at": clock.now(session=session).isoformat()}


def _pick_option(forbid: list[str], allow: list[str], code: str | None) -> dict[str, Any]:
    """The code option the person chose, or the recommended one. Only safe codes are offered."""
    if not forbid:
        raise HTTPException(status_code=400, detail="Tick at least one food you don't eat")
    options = _engine(meal_options, forbid, allow)
    if not code:
        return options[0]
    chosen = next((o for o in options if o["code"] == code), None)
    if chosen is None:
        offered = ", ".join(o["code"] for o in options)
        raise HTTPException(status_code=400, detail=f"{code} isn't safe for these food rules. Choose one of: {offered}")
    return chosen


def _save(
    session: Session,
    passenger: Passenger,
    *,
    lang: str,
    forbid: list[str],
    allow: list[str],
    consent: dict[str, Any],
    option: dict[str, Any],
    source: str,
    fasting_dates: list[str] | None = None,
    allergens: list[str] | None = None,
) -> tuple[Profile, MealPromise]:
    """Create or replace the passenger's profile and promise, then write C1.

    Filling in the form again (a rehearsal, or a changed answer) updates the same promise.
    """
    now = clock.now(session=session)
    flight = session.get(Flight, passenger.flight_id)
    keep_days = 365 if consent["save_profile"] else 30
    expires_at = (flight.sta if flight else now) + timedelta(days=keep_days)

    profile = session.get(Profile, passenger.profile_id) if passenger.profile_id else None
    if profile is None:
        profile = Profile(id=new_id("PF"), passenger_id=passenger.id, created_at=now)
    profile.lang = lang
    # Food rules only, never the diet's name: "jain" or "halal" would record the person's creed (APPI special-care data).
    # The quick picks a passenger tapped stay on their phone.
    profile.presets = []
    profile.forbid = list(forbid)
    profile.allow = list(allow)
    profile.fasting_dates = list(fasting_dates or [])
    profile.allergens = list(allergens or [])
    profile.consent = consent
    profile.expires_at = expires_at
    session.add(profile)

    promise = session.exec(
        select(MealPromise).where(MealPromise.passenger_id == passenger.id, MealPromise.flight_id == passenger.flight_id)
    ).first()
    if promise is None:
        promise = MealPromise(id=new_id("MP"), profile_id=profile.id, passenger_id=passenger.id, flight_id=passenger.flight_id, code="")
    promise.profile_id = profile.id
    promise.code = option["code"]
    promise.kitchen_note = option["kitchen_note"]
    promise.label_mark = option["label_mark"]
    session.add(promise)

    passenger.profile_id = profile.id
    session.add(passenger)
    session.flush()

    events.record_checkpoint(
        promise.id,
        passenger.id,
        passenger.flight_id,
        "C1",
        "ok",
        source=source,
        detail=profile_line(forbid, option["code"]),
        data={"code": option["code"], "kitchen_note": option["kitchen_note"], "forbid": list(forbid)},
        session=session,
    )
    return profile, promise


@router.post("/passenger/meal-options")
def passenger_meal_options(body: OptionsIn) -> dict[str, Any]:
    """Like /rules/code-options, but never empty: SPML with a full kitchen note when no code fits."""
    return {"options": _engine(meal_options, body.forbid, body.allow)}


@router.get("/passenger/lookup")
def lookup(pnr: str, surname: str, session: SessionDep) -> Passenger:
    passenger = session.exec(
        select(Passenger).where(Passenger.pnr == clean_pnr(pnr), Passenger.surname == clean_surname(surname))
    ).first()
    if passenger is None:
        raise HTTPException(status_code=404, detail="No booking with that reference and surname")
    return passenger


@router.post("/profiles")
def save_profile(body: ProfileIn, session: SessionDep) -> dict[str, Any]:
    passenger = session.get(Passenger, body.passenger_id)
    if passenger is None:
        raise HTTPException(status_code=404, detail=f"No passenger {body.passenger_id}")
    consent = _consent(body.consent, session)
    option = _pick_option(body.forbid, body.allow, body.chosen_code)
    profile, promise = _save(
        session,
        passenger,
        lang=body.lang,
        forbid=body.forbid,
        allow=body.allow,
        consent=consent,
        option=option,
        source="passenger_app",
        fasting_dates=body.fasting_dates,
        allergens=body.allergens,
    )

    booking_check = _engine(engine.check_booking, body.forbid, passenger.ssr_meal)
    # No SSR at all is not a wrong code: the new promise asks for one.
    if passenger.ssr_meal and not booking_check["ok"]:
        problem = booking_check["problem"]
        suggested = booking_check.get("suggested_code") or option["code"]
        alerts.raise_alert(
            passenger.flight_id,
            "WRONG_CODE",
            "critical",
            title=f"{passenger.seat} {passenger.surname}: booked {passenger.ssr_meal}, needs {suggested}",
            body=problem["message"]["en"],
            passenger_id=passenger.id,
            promise_id=promise.id,
            evidence={
                "booked_code": passenger.ssr_meal,
                "contains": problem["contains"],
                "suggested_code": suggested,
                "forbid": list(body.forbid),
                "source": "passenger_app",
            },
            session=session,
        )
    session.commit()
    return {"profile": profile, "promise": promise, "booking_check": booking_check}


def _judge_pnr(session: Session) -> str:
    while True:
        pnr = "J" + new_id("X", 5)[2:]
        if session.exec(select(Passenger.id).where(Passenger.pnr == pnr)).first() is None:
            return pnr


def _next_passenger_id(session: Session) -> str:
    ids = session.exec(select(Passenger.id)).all()
    numbers = [int(i[3:]) for i in ids if i.startswith("PX-") and i[3:].isdigit()]
    return f"PX-{max(numbers, default=0) + 1:04d}"


def _release_judge_meal(session: Session, passenger_id: str) -> None:
    """Give back the meal m6 reserved for a judge's old answers, so the new answers get a fresh match."""
    from app.modules.m6_matcher.models import LateRequest

    for item in session.exec(select(MealItem).where(MealItem.assigned_passenger_id == passenger_id)).all():
        item.assigned_passenger_id = None
        session.add(item)
    for lr in session.exec(select(LateRequest).where(LateRequest.passenger_id == passenger_id)).all():
        session.delete(lr)
    now = clock.now(session=session).isoformat()
    for alert in session.exec(
        select(Alert).where(Alert.passenger_id == passenger_id, Alert.type == "LATE_REQUEST", Alert.status != "resolved")
    ).all():
        alert.status = "resolved"
        alert.actions = [*alert.actions, {"action": "resolve", "actor": "judge", "at": now, "note": "Changed their answers"}]
        session.add(alert)


def _rejoin(body: JoinIn, session: Session, option: dict[str, Any], consent: dict[str, Any]) -> dict[str, Any]:
    passenger = session.get(Passenger, body.passenger_id)
    if passenger is None or not passenger.is_judge:
        raise HTTPException(status_code=404, detail="That judge seat is gone (the demo was reset). Join again.")
    passenger.display_name = body.display_name
    passenger.given = body.display_name.upper()
    _release_judge_meal(session, passenger.id)
    profile, promise = _save(
        session,
        passenger,
        lang=body.lang,
        forbid=body.forbid,
        allow=body.allow,
        consent=consent,
        option=option,
        source="judge_join",
        allergens=body.allergens,
    )
    session.commit()
    return {"passenger": passenger, "profile": profile, "promise": promise}


@router.post("/join")
def join(body: JoinIn, session: SessionDep) -> dict[str, Any]:
    option = _pick_option(body.forbid, body.allow, None)
    consent = _consent(body.consent, session)
    if body.passenger_id:
        return _rejoin(body, session, option, consent)
    with _join_lock:
        session.commit()  # end any read started before the lock, so we see seats taken a moment ago
        flight = session.get(Flight, FLIGHT_ID)
        if flight is None:
            raise HTTPException(status_code=404, detail=f"No flight {FLIGHT_ID}")
        taken = set(session.exec(select(Passenger.seat).where(Passenger.flight_id == flight.id)).all())
        try:
            seat = next_judge_seat(taken)
        except NoSeatLeft as exc:
            raise HTTPException(status_code=409, detail="All demo seats are taken") from exc
        passenger = Passenger(
            id=_next_passenger_id(session),
            flight_id=flight.id,
            seat=seat,
            cabin=cabin_for(seat),
            surname="JUDGE",
            given=body.display_name.upper(),
            title="",
            pnr=_judge_pnr(session),
            is_judge=True,
            display_name=body.display_name,
        )
        session.add(passenger)
        session.flush()
        profile, promise = _save(
            session,
            passenger,
            lang=body.lang,
            forbid=body.forbid,
            allow=body.allow,
            consent=consent,
            option=option,
            source="judge_join",
            allergens=body.allergens,
        )
        session.commit()
    return {"passenger": passenger, "profile": profile, "promise": promise}
