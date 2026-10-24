"""Alerts for the ops console, crew and caterer."""
from datetime import datetime
from typing import Any

from sqlmodel import Session, select

from . import clock
from .db import use_session
from .ids import new_id
from .models import Alert

SEVERITIES = ("critical", "warning", "info")


def raise_alert(
    flight_id: str,
    type: str,  # noqa: A002 - contract name
    severity: str,
    title: str,
    body: str,
    passenger_id: str | None = None,
    promise_id: str | None = None,
    evidence: dict[str, Any] | None = None,
    deadline_at: datetime | None = None,
    *,
    session: Session | None = None,
) -> Alert:
    """Create an Alert. While one with the same (type, passenger_id) is unresolved, return that one."""
    if severity not in SEVERITIES:
        raise ValueError(f"unknown severity {severity}")
    with use_session(session) as s:
        open_one = s.exec(
            select(Alert).where(
                Alert.flight_id == flight_id,
                Alert.type == type,
                Alert.passenger_id == passenger_id,
                Alert.status != "resolved",
            )
        ).first()
        if open_one:
            return open_one
        alert = Alert(
            id=new_id("AL"),
            flight_id=flight_id,
            type=type,
            severity=severity,
            passenger_id=passenger_id,
            promise_id=promise_id,
            title=title,
            body=body,
            evidence=evidence or {},
            deadline_at=deadline_at,
            created_at=clock.now(session=s),
        )
        s.add(alert)
        return alert
