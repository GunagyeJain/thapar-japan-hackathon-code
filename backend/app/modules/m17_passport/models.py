"""m17 tables."""
from datetime import datetime
from typing import Any

from sqlmodel import Field, SQLModel

from app.core.db import TZDateTime, json_col


class Passport(SQLModel, table=True):
    """A person's food rules, owned by them and kept across bookings. Never a diet name."""

    id: str = Field(primary_key=True)  # PP-…
    passenger_id: str = Field(index=True)
    lang: str = "en"
    rules: dict[str, Any] = Field(default_factory=dict, sa_column=json_col())  # Rules, see docs/plan/v2.md
    code: str | None = None  # nearest JAL special-meal code, or None when a main-menu dish already fits
    kitchen_note: str | None = None
    label_mark: dict[str, Any] = Field(default_factory=dict, sa_column=json_col())
    source: str = "seed"  # form | desk | ssr | seed
    confirmed: bool = True
    updated_at: datetime = Field(sa_type=TZDateTime)


class RadarQuestion(SQLModel, table=True):
    """One tap-to-answer question the Calendar Radar sent: "Your JL740 on 25 Oct falls on Sharad Purnima. Fasting?"

    `label` is what the public calendar calls that date, never a reason the person gave.
    """

    id: str = Field(primary_key=True)  # RQ-…
    passenger_id: str = Field(index=True)
    date: str  # ISO date of the flight the question is about
    flight_no: str
    rule_id: str  # the passport's time rule (TR-…)
    label: dict[str, Any] = Field(default_factory=dict, sa_column=json_col())  # Text
    status: str = "asked"  # asked | answered
    answer: str | None = None  # yes | no
    asked_at: datetime = Field(sa_type=TZDateTime)
    answered_at: datetime | None = Field(default=None, sa_type=TZDateTime)
