"""Key/value settings (sim clock anchor, seed_epoch)."""
from sqlmodel import Session

from .db import use_session
from .models import Setting


def get_setting(key: str, default: str | None = None, *, session: Session | None = None) -> str | None:
    with use_session(session) as s:
        row = s.get(Setting, key)
        return row.value if row else default


def set_setting(key: str, value: str, *, session: Session | None = None) -> None:
    with use_session(session) as s:
        row = s.get(Setting, key)
        if row:
            row.value = value
            s.add(row)
        else:
            s.add(Setting(key=key, value=value))


def seed_epoch(*, session: Session | None = None) -> int:
    return int(get_setting("seed_epoch", "0", session=session) or 0)
