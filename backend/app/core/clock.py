"""Sim clock. Every deadline and countdown uses clock.now(), never the wall clock.

The clock runs at real speed from the moment it was last set; POST /api/clock moves it.
"""
from datetime import datetime, timedelta, timezone

from sqlmodel import Session

from .settings import get_setting, set_setting

IST = timezone(timedelta(hours=5, minutes=30), "IST")
JST = timezone(timedelta(hours=9), "JST")
TZ_NAME = "Asia/Kolkata"
START = datetime(2026, 10, 23, 18, 0, tzinfo=IST)

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
    _anchor = (sim, wall)
    return sim


def forget() -> None:
    """Drop the in-memory anchor so the next now() reads the database again."""
    global _anchor
    _anchor = None
