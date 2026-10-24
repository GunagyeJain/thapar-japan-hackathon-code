"""m17 tables."""
from datetime import datetime
from typing import Any

from sqlmodel import Field, SQLModel

from app.core.db import TZDateTime, json_col


class Passport(SQLModel, table=True):
    """A person's food rules, owned by them and kept across bookings. Never a diet name or the person's own words."""

    id: str = Field(primary_key=True)  # PP-…
    passenger_id: str = Field(index=True)
    lang: str = "en"
    rules: dict[str, Any] = Field(default_factory=dict, sa_column=json_col())  # Rules, see docs/plan/v2.md
    code: str | None = None  # nearest JAL special-meal code, or None when a main-menu dish already fits
    kitchen_note: str | None = None
    label_mark: dict[str, Any] = Field(default_factory=dict, sa_column=json_col())
    source: str = "seed"  # chat | form | desk | ssr | seed
    confirmed: bool = True
    updated_at: datetime = Field(sa_type=TZDateTime)
