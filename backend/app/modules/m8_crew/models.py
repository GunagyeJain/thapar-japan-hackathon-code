from datetime import datetime
from typing import Any

from sqlmodel import Field, SQLModel

from app.core.db import TZDateTime, json_col


class CrewEventLog(SQLModel, table=True):
    """Every crew event applied, keyed by the tablet's client_id (makes sync idempotent)."""

    client_id: str = Field(primary_key=True)
    flight_id: str = Field(index=True)
    seed_epoch: int
    type: str
    at: datetime = Field(sa_type=TZDateTime)
    payload: dict[str, Any] = Field(default_factory=dict, sa_column=json_col())
