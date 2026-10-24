"""SQLite engine (WAL mode), sessions, and column types shared by every model."""
from collections.abc import Iterator
from contextlib import contextmanager
from datetime import datetime
from typing import Annotated

from fastapi import Depends
from sqlalchemy import JSON, Column, String, event
from sqlalchemy.types import TypeDecorator
from sqlmodel import Session, SQLModel, create_engine

from .paths import DB_PATH

DB_PATH.parent.mkdir(parents=True, exist_ok=True)
engine = create_engine(
    f"sqlite:///{DB_PATH.as_posix()}",
    connect_args={"check_same_thread": False, "timeout": 15},
)


@event.listens_for(engine, "connect")
def _sqlite_pragmas(dbapi_conn, _record) -> None:
    cur = dbapi_conn.cursor()
    cur.execute("PRAGMA journal_mode=WAL")
    cur.execute("PRAGMA synchronous=NORMAL")
    cur.execute("PRAGMA busy_timeout=15000")
    cur.close()


class TZDateTime(TypeDecorator):
    """Timezone-aware datetime stored as ISO 8601 text with its offset (+05:30 / +09:00)."""

    impl = String
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if isinstance(value, str):
            value = datetime.fromisoformat(value)
        if value.tzinfo is None:
            raise ValueError("naive datetime: times must carry an offset")
        return value.isoformat()

    def process_result_value(self, value, dialect):
        return None if value is None else datetime.fromisoformat(value)


def json_col() -> Column:
    """A JSON column. Reassign the whole value to save a change; in-place edits aren't tracked."""
    return Column(JSON)


def new_session() -> Session:
    return Session(engine, expire_on_commit=False)


def get_session() -> Iterator[Session]:
    with new_session() as session:
        yield session


SessionDep = Annotated[Session, Depends(get_session)]


@contextmanager
def use_session(session: Session | None) -> Iterator[Session]:
    """Use the caller's session (flush only), or open one and commit at the end."""
    if session is not None:
        yield session
        session.flush()
        return
    with new_session() as own:
        yield own
        own.commit()


def create_tables() -> None:
    SQLModel.metadata.create_all(engine)
