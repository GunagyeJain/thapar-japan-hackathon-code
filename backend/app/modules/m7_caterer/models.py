"""m7 tables."""
from datetime import datetime
from typing import Any

from sqlalchemy import UniqueConstraint
from sqlmodel import Field, SQLModel

from app.core.db import TZDateTime, json_col


class MealListVersion(SQLModel, table=True):
    """One numbered, timestamped, hashed meal list sent to the caterer."""

    __table_args__ = (UniqueConstraint("flight_id", "version"),)

    id: str = Field(primary_key=True)  # ML-…
    flight_id: str = Field(index=True)
    version: int
    created_at: datetime = Field(sa_type=TZDateTime)
    sha256: str
    ack_at: datetime | None = Field(default=None, sa_type=TZDateTime)
    ack_by: str | None = None
    lines: list[dict[str, Any]] = Field(default_factory=list, sa_column=json_col())
    diff: dict[str, Any] = Field(default_factory=dict, sa_column=json_col())
