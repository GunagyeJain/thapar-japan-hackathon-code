"""Checkpoint events (C1..C5, LATE): the audit trail of every meal promise."""
from datetime import datetime
from typing import Any

from sqlmodel import Session, select

from . import clock
from .db import use_session
from .ids import new_id
from .models import CHECKPOINTS, CheckpointEvent, MealPromise

RESULT_TO_STATE = {"ok": "ok", "fail": "fail", "fixed": "fixed"}  # "info" leaves the checkpoint as is


def promise_status(checkpoints: dict[str, str], current: str) -> str:
    states = set(checkpoints.values())
    if "fail" in states:
        return "broken"
    if "fixed" in states:
        return "fixed"
    return "at_risk" if current == "at_risk" else "ok"


def record_checkpoint(
    promise_id: str | None,
    passenger_id: str,
    flight_id: str,
    checkpoint: str,
    result: str,
    source: str,
    detail: str,
    data: dict[str, Any] | None = None,
    *,
    key: str | None = None,
    at: datetime | None = None,
    session: Session | None = None,
) -> CheckpointEvent:
    """Write a CheckpointEvent and update MealPromise.checkpoints and status.

    Pass `session=` when you call this inside an endpoint that also writes, so everything lands
    in one transaction. `key` makes retries idempotent: the same key returns the first event.
    """
    if checkpoint not in (*CHECKPOINTS, "LATE"):
        raise ValueError(f"unknown checkpoint {checkpoint}")
    if result not in ("ok", "fail", "fixed", "info"):
        raise ValueError(f"unknown result {result}")
    with use_session(session) as s:
        if key:
            existing = s.exec(select(CheckpointEvent).where(CheckpointEvent.key == key)).first()
            if existing:
                return existing
        ev = CheckpointEvent(
            id=new_id("CE"),
            promise_id=promise_id,
            passenger_id=passenger_id,
            flight_id=flight_id,
            checkpoint=checkpoint,
            result=result,
            at=at or clock.now(session=s),
            source=source,
            detail=detail,
            data=data or {},
            key=key,
        )
        s.add(ev)
        promise = s.get(MealPromise, promise_id) if promise_id else None
        if promise and checkpoint in CHECKPOINTS and result in RESULT_TO_STATE:
            checkpoints = {**promise.checkpoints, checkpoint: RESULT_TO_STATE[result]}
            promise.checkpoints = checkpoints
            promise.status = promise_status(checkpoints, promise.status)
            s.add(promise)
        return ev
