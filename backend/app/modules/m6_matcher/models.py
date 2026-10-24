"""m6 tables."""
from datetime import datetime
from typing import Any

from sqlmodel import Field, SQLModel

from app.core.db import TZDateTime, json_col


class LateRequest(SQLModel, table=True):
    id: str = Field(primary_key=True)  # LR-…
    flight_id: str = Field(index=True)
    passenger_id: str = Field(index=True)
    at: datetime = Field(sa_type=TZDateTime)
    source: str  # checkin | gate | crew | join
    status: str  # reserved | voucher
    forbid: list[str] = Field(default_factory=list, sa_column=json_col())
    allow: list[str] = Field(default_factory=list, sa_column=json_col())
    item_id: str | None = None
    match: dict[str, Any] = Field(default_factory=dict, sa_column=json_col())
