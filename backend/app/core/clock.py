"""Sim clock. Every deadline and countdown uses clock.now(), never the wall clock.

The clock runs at real speed from the moment it was last set; POST /api/clock moves it.
"""
import json
from datetime import datetime, timedelta, timezone

from sqlmodel import Session

from .settings import get_setting, set_setting

IST = timezone(timedelta(hours=5, minutes=30), "IST")
JST = timezone(timedelta(hours=9), "JST")
TZ_NAME = "Asia/Kolkata"
START = datetime(2026, 10, 23, 18, 0, tzinfo=IST)
HISTORY_KEEP = 50  # clock moves remembered, so a device's real time can be placed on the sim clock later

_anchor: tuple[datetime, datetime] | None = None  # (sim time, wall time when it was set)


def _wall() -> datetime:
    return datetime.now(timezone.utc)


def _load(session: Session | None) -> tuple[datetime, datetime]:
    global _anchor
    if _anchor is None:
        sim = get_setting("sim_now", session=session)
        wall = get_setting("sim_wall_at", session=session)
        if sim and wall:
            _anchor = (datetime.fromisoformat(sim), datetime.fromisoformat(wall))
        else:
            _anchor = (START, _wall())
    return _anchor


def now(*, session: Session | None = None) -> datetime:
    """Current sim time in IST."""
    sim, wall = _load(session)
    return (sim + (_wall() - wall)).astimezone(IST)


def set(dt: datetime, *, session: Session | None = None) -> datetime:  # noqa: A001 - contract name
    """Move the sim clock to dt (must carry an offset)."""
    global _anchor
    if dt.tzinfo is None:
        raise ValueError("sim time must carry an offset, e.g. 2026-10-24T23:02:00+05:30")
    sim = dt.astimezone(IST)
    wall = _wall()
    set_setting("sim_now", sim.isoformat(), session=session)
    set_setting("sim_wall_at", wall.isoformat(), session=session)
    history = json.loads(get_setting("sim_history", "[]", session=session))
    set_setting("sim_history", json.dumps([*history, [sim.isoformat(), wall.isoformat()]][-HISTORY_KEEP:]), session=session)
    _anchor = (sim, wall)
    return sim


def at_wall(wall: datetime, *, session: Session | None = None) -> datetime:
    """Sim time at a past real-world moment, using the clock setting in effect then.

    The crew tablet is offline when the demo moves the clock, so its own sim time can be hours behind;
    the device's real time is right, and this places it on the sim clock.
    """
    moves = [(datetime.fromisoformat(s), datetime.fromisoformat(w))
             for s, w in json.loads(get_setting("sim_history", "[]", session=session))]
    before = [m for m in moves if m[1] <= wall]
    sim, set_at = before[-1] if before else (moves[0] if moves else _load(session))
    return (sim + (wall - set_at)).astimezone(IST)


def forget() -> None:
    """Drop the in-memory anchor so the next now() reads the database again."""
    global _anchor
    _anchor = None
