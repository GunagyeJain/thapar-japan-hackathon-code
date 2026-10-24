"""Where the story is: the current step and which steps have run. Lives in Settings, so a reset clears it."""
import json

from app.core.db import new_session
from app.core.settings import get_setting, seed_epoch, set_setting

CURRENT, DONE, RESET_EPOCH = "story_current", "story_done", "story_reset_epoch"


def current() -> int:
    return int(get_setting(CURRENT, "0") or 0)


def done() -> list[int]:
    return json.loads(get_setting(DONE, "[]") or "[]")


def mark(n: int) -> None:
    with new_session() as s:
        ran = sorted({*json.loads(get_setting(DONE, "[]", session=s) or "[]"), n})
        set_setting(DONE, json.dumps(ran), session=s)
        set_setting(CURRENT, str(n), session=s)
        s.commit()


def mark_reset(epoch: int) -> None:
    with new_session() as s:
        set_setting(RESET_EPOCH, str(epoch), session=s)
        s.commit()


def is_fresh() -> bool:
    """True right after our own reset, before any other step ran."""
    with new_session() as s:
        epoch = get_setting(RESET_EPOCH, session=s)
        ran = json.loads(get_setting(DONE, "[]", session=s) or "[]")
        return epoch is not None and int(epoch) == seed_epoch(session=s) and set(ran) <= {0}
