"""Demo data: m0's seed() loads shared/seed/*.json; reset() runs every module's seed() in order."""
import json
from typing import Any

from sqlmodel import Session, SQLModel, select

from . import clock
from .db import new_session
from .models import CheckpointEvent, Flight, MealItem, MealPromise, MealSpec, Passenger, Profile
from .paths import SEED_DIR
from .settings import seed_epoch, set_setting

FLIGHT_ID = "JL740-20261025"


def load_json(name: str) -> Any:
    return json.loads((SEED_DIR / name).read_text(encoding="utf-8"))


def seed(session: Session) -> None:
    """m0 seed: flight, passengers, cast profiles + promises (with C1), meal specs and items."""
    session.add(Flight(**load_json("flight.json")))
    session.add_all(Passenger(**p) for p in load_json("passengers.json"))
    profiles = load_json("profiles.json")
    session.add_all(Profile(**p) for p in profiles["profiles"])
    session.add_all(MealPromise(**p) for p in profiles["promises"])
    session.add_all(CheckpointEvent(**e) for e in profiles["events"])
    session.add_all(MealSpec(**s) for s in load_json("meal_specs.json"))
    session.add_all(MealItem(**i) for i in load_json("meal_items.json"))
    clock.set(clock.START, session=session)


def _snapshot_judges(session: Session) -> list[tuple[Passenger, list[Profile], list[MealPromise]]]:
    judges = session.exec(select(Passenger).where(Passenger.is_judge == True)).all()  # noqa: E712
    snap = []
    for j in judges:
        profiles = session.exec(select(Profile).where(Profile.passenger_id == j.id)).all()
        promises = session.exec(select(MealPromise).where(MealPromise.passenger_id == j.id)).all()
        snap.append(
            (
                Passenger(**j.model_dump()),
                [Profile(**p.model_dump()) for p in profiles],
                [MealPromise(**p.model_dump()) for p in promises],
            )
        )
    return snap


def _restore_judges(session: Session, snap, flight_ids: set[str]) -> int:
    restored = 0
    for passenger, profiles, promises in snap:
        if passenger.flight_id not in flight_ids:
            continue
        session.add(passenger)
        session.add_all(profiles)
        for promise in promises:
            promise.checkpoints = {"C1": "ok", "C2": "pending", "C3": "pending", "C4": "pending", "C5": "pending"}
            promise.status = "ok"
            session.add(promise)
            session.add(
                CheckpointEvent(
                    id=f"CE-J{promise.id[3:]}",
                    promise_id=promise.id,
                    passenger_id=passenger.id,
                    flight_id=passenger.flight_id,
                    checkpoint="C1",
                    result="ok",
                    at=clock.now(session=session),
                    source="judge_join",
                    detail=f"Judge kept across reset: {promise.code}",
                    key=f"reset-keep:{promise.id}",
                )
            )
        restored += 1
    return restored


def reset(keep_judges: bool = True) -> int:
    """Wipe every table, run every module's seed() (m0 first), bump seed_epoch. Returns the new epoch."""
    from app.registry import MODULES  # late import: registry imports every module

    with new_session() as session:
        epoch = seed_epoch(session=session) + 1
        snap = _snapshot_judges(session) if keep_judges else []
        for table in reversed(SQLModel.metadata.sorted_tables):
            session.execute(table.delete())
        session.flush()
        for module in MODULES:
            module.seed(session)
            session.flush()
        flight_ids = set(session.exec(select(Flight.id)).all())
        _restore_judges(session, snap, flight_ids)
        set_setting("seed_epoch", str(epoch), session=session)
        session.commit()
    clock.forget()
    return epoch


def ensure_seeded() -> None:
    """On startup: seed an empty database."""
    with new_session() as session:
        has_flight = session.exec(select(Flight.id)).first() is not None
    if not has_flight:
        reset(keep_judges=False)
