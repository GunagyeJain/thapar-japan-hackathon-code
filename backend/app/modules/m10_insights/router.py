from typing import Any

from fastapi import APIRouter, HTTPException
from sqlmodel import or_, select

from app.core.db import SessionDep
from app.core.models import Alert, CheckpointEvent, MealPromise, Passenger, RawMessage

router = APIRouter(prefix="/api", tags=["m10 · insights"])

FIX_ACTIONS = ("request_again", "resolve")  # the human step that fixed it, in order of preference


def _message_for(messages: list[RawMessage], ev: CheckpointEvent) -> dict[str, Any] | None:
    """The PNL/ADL a C2 event came from: the latest one received at or before it."""
    if ev.checkpoint != "C2":
        return None
    seen = [m for m in messages if m.received_at <= ev.at]
    m = max(seen, key=lambda m: m.seq, default=None)
    return {"id": m.id, "kind": m.kind, "seq": m.seq, "received_at": m.received_at} if m else None


def _breakpoint(events: list[CheckpointEvent], alerts: list[Alert]) -> dict[str, Any] | None:
    """The first failed checkpoint and, if a later event fixed it, when and by whom."""
    fail = next((e for e in events if e.result == "fail"), None)
    if not fail:
        return None
    alert = next((a for a in alerts if a.id == (fail.data or {}).get("alert_id")), None) \
        or next((a for a in alerts if a.created_at == fail.at), None)
    fixed = next((e for e in events if e.checkpoint == fail.checkpoint and e.result == "fixed" and e.at >= fail.at), None)
    human = next((x for name in FIX_ACTIONS for x in (alert.actions if alert else []) if x["action"] == name), None)
    return {
        "checkpoint": fail.checkpoint, "at": fail.at, "detail": fail.detail, "source": fail.source,
        "alert_id": alert.id if alert else None, "alert_type": alert.type if alert else None,
        "deadline_at": alert.deadline_at if alert else None,
        "fixed_at": fixed.at if fixed else None, "fixed_detail": fixed.detail if fixed else None,
        "fixed_by": human["actor"] if fixed and human else None, "fix_action": human["action"] if fixed and human else None,
    }


@router.get("/promises/{promise_id}/timeline")
def timeline(promise_id: str, session: SessionDep) -> dict[str, Any]:
    promise = session.get(MealPromise, promise_id)
    if not promise:
        raise HTTPException(404, f"No promise {promise_id}")
    passenger = session.get(Passenger, promise.passenger_id)
    # Events written before the promise existed (promise_id null) still belong to this passenger's story.
    events = sorted(session.exec(select(CheckpointEvent).where(
        CheckpointEvent.passenger_id == promise.passenger_id,
        or_(CheckpointEvent.promise_id == promise.id, CheckpointEvent.promise_id.is_(None)))).all(),  # type: ignore[union-attr]
        key=lambda e: e.at)
    alerts = list(session.exec(select(Alert).where(Alert.passenger_id == promise.passenger_id)).all())
    messages = list(session.exec(select(RawMessage).where(RawMessage.flight_id == promise.flight_id)).all())
    actions = sorted(({"alert_id": a.id, "alert_type": a.type, **x} for a in alerts for x in a.actions), key=lambda x: x["at"])
    return {
        "promise": promise,
        "passenger": passenger,
        "events": [{**e.model_dump(), "message": _message_for(messages, e)} for e in events],
        "actions": actions,
        "breakpoint": _breakpoint(events, alerts),
    }
