"""Outbox: every message to a passenger, the crew or the caterer. Nothing is really sent."""
from typing import Any

from sqlmodel import Session

from . import clock
from .db import use_session
from .ids import new_id
from .models import Notification

CHANNELS = ("sms", "whatsapp", "email", "crew", "caterer")


def notify(
    channel: str,
    to: str,
    title: str,
    body: str,
    lang: str = "en",
    ref: dict[str, Any] | None = None,
    *,
    session: Session | None = None,
) -> Notification:
    """Write a Notification. `to` is a passenger id, "caterer" or "crew:JL740"."""
    if channel not in CHANNELS:
        raise ValueError(f"unknown channel {channel}")
    with use_session(session) as s:
        note = Notification(
            id=new_id("NT"),
            channel=channel,
            to=to,
            lang=lang,
            title=title,
            body=body,
            at=clock.now(session=s),
            ref=ref or {},
        )
        s.add(note)
        return note
