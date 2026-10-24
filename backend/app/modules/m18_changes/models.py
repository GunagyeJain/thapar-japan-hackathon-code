"""m18 tables: the change log, and who didn't board. New tables only; core tables keep their columns."""
from datetime import datetime
from typing import Any

from sqlmodel import Field, SQLModel

from app.core.db import TZDateTime, json_col


class ChangeEvent(SQLModel, table=True):
    """One late need (or a dropped request, or a no-show) and what the router did with it.

    Shape: `ChangeEvent` in docs/plan/v2.md. `today` is what today's process would do with the same event.
    """

    id: str = Field(primary_key=True)  # CH-…
    flight_id: str = Field(index=True)
    seq: int  # order on this flight's log
    passenger_id: str | None = Field(default=None, index=True)
    seat: str | None = None
    name: str | None = None
    at: datetime = Field(sa_type=TZDateTime)
    channel: str
    kind: str
    window: str
    request: dict[str, Any] = Field(default_factory=dict, sa_column=json_col())
    decision: dict[str, Any] = Field(default_factory=dict, sa_column=json_col())
    message: dict[str, Any] | None = Field(default=None, sa_column=json_col())
    today: dict[str, Any] = Field(default_factory=dict, sa_column=json_col())
    status: str = "done"  # done | waiting (no passenger to act on yet)
    chaos_key: str | None = Field(default=None, index=True)  # Chaos Mode's event key: a second run adds nothing


class NoShow(SQLModel, table=True):
    """A passenger who didn't board, and the meal that became free for someone else."""

    id: str = Field(primary_key=True)  # NS-…
    flight_id: str = Field(index=True)
    passenger_id: str = Field(index=True)
    at: datetime = Field(sa_type=TZDateTime)
    released_item_id: str | None = None
