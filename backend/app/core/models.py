"""Core entities. Field names match shared/README.md exactly (frozen: add optional fields only)."""
from datetime import datetime
from typing import Any

from sqlmodel import Field, SQLModel

from .db import TZDateTime, json_col

Text = dict[str, str]  # {en, hi?, ja?}

CHECKPOINTS = ("C1", "C2", "C3", "C4", "C5")


def empty_checkpoints() -> dict[str, str]:
    return {c: "pending" for c in CHECKPOINTS}


class Flight(SQLModel, table=True):
    id: str = Field(primary_key=True)
    flight_no: str
    date: str
    origin: str
    dest: str
    std: datetime = Field(sa_type=TZDateTime)
    sta: datetime = Field(sa_type=TZDateTime)
    aircraft: str
    cabins: dict[str, Any] = Field(default_factory=dict, sa_column=json_col())
    special_meal_cutoff: datetime = Field(sa_type=TZDateTime)
    caterer_final_list_at: datetime = Field(sa_type=TZDateTime)
    dispatch_at: datetime = Field(sa_type=TZDateTime)
    boarding_at: datetime = Field(sa_type=TZDateTime)
    status: str = "scheduled"  # scheduled | delayed | departed
    delay_min: int = 0
    caterer: str
    backup_count: int = 4


class Passenger(SQLModel, table=True):
    id: str = Field(primary_key=True)
    flight_id: str = Field(index=True, foreign_key="flight.id")
    seat: str
    cabin: str  # C | Y
    surname: str
    given: str
    title: str
    pnr: str = Field(index=True)
    ssr_meal: str | None = None
    ssr_note: str | None = None
    inbound: dict[str, Any] | None = Field(default=None, sa_column=json_col())
    group: str | None = None
    is_judge: bool = False
    display_name: str | None = None
    profile_id: str | None = None


class Profile(SQLModel, table=True):
    id: str = Field(primary_key=True)
    passenger_id: str = Field(index=True)
    lang: str = "en"
    presets: list[str] = Field(default_factory=list, sa_column=json_col())
    forbid: list[str] = Field(default_factory=list, sa_column=json_col())
    allow: list[str] = Field(default_factory=list, sa_column=json_col())
    fasting_dates: list[str] = Field(default_factory=list, sa_column=json_col())
    allergens: list[str] = Field(default_factory=list, sa_column=json_col())
    consent: dict[str, Any] = Field(default_factory=dict, sa_column=json_col())
    created_at: datetime = Field(sa_type=TZDateTime)
    expires_at: datetime | None = Field(default=None, sa_type=TZDateTime)


class MealPromise(SQLModel, table=True):
    id: str = Field(primary_key=True)
    profile_id: str = Field(index=True)
    passenger_id: str = Field(index=True)
    flight_id: str = Field(index=True)
    code: str
    kitchen_note: str | None = None
    label_mark: Text = Field(default_factory=dict, sa_column=json_col())
    status: str = "ok"  # ok | at_risk | broken | fixed
    checkpoints: dict[str, str] = Field(default_factory=empty_checkpoints, sa_column=json_col())


class CheckpointEvent(SQLModel, table=True):
    id: str = Field(primary_key=True)
    promise_id: str | None = Field(default=None, index=True)
    passenger_id: str = Field(index=True)
    flight_id: str = Field(index=True)
    checkpoint: str  # C1..C5 | LATE
    result: str  # ok | fail | fixed | info
    at: datetime = Field(sa_type=TZDateTime)
    source: str
    detail: str
    data: dict[str, Any] = Field(default_factory=dict, sa_column=json_col())
    key: str | None = Field(default=None, unique=True)


class MealSpec(SQLModel, table=True):
    id: str = Field(primary_key=True)
    name: Text = Field(default_factory=dict, sa_column=json_col())
    code: str | None = None
    kind: str  # special | main | backup
    tags: list[str] = Field(default_factory=list, sa_column=json_col())
    certified: bool = False
    source: str = "caterer"  # caterer | recipe_check


class MealItem(SQLModel, table=True):
    id: str = Field(primary_key=True)  # TB-XXXXXX
    flight_id: str = Field(index=True)
    spec_id: str
    kind: str  # special | spare | main | backup
    galley: str  # G1 | G2
    position: str
    assigned_passenger_id: str | None = None
    status: str = "planned"  # planned | loaded | missing | served


class Alert(SQLModel, table=True):
    id: str = Field(primary_key=True)
    flight_id: str = Field(index=True)
    type: str
    severity: str  # critical | warning | info
    passenger_id: str | None = None
    promise_id: str | None = None
    title: str
    body: str
    evidence: dict[str, Any] = Field(default_factory=dict, sa_column=json_col())
    deadline_at: datetime | None = Field(default=None, sa_type=TZDateTime)
    status: str = "open"  # open | acknowledged | resolved
    created_at: datetime = Field(sa_type=TZDateTime)
    actions: list[dict[str, Any]] = Field(default_factory=list, sa_column=json_col())


class RawMessage(SQLModel, table=True):
    id: str = Field(primary_key=True)
    flight_id: str = Field(index=True)
    kind: str  # PNL | ADL
    seq: int
    received_at: datetime = Field(sa_type=TZDateTime)
    text: str


class Notification(SQLModel, table=True):
    id: str = Field(primary_key=True)
    channel: str  # sms | whatsapp | email | crew | caterer
    to: str = Field(index=True)
    lang: str = "en"
    title: str
    body: str
    at: datetime = Field(sa_type=TZDateTime)
    ref: dict[str, Any] = Field(default_factory=dict, sa_column=json_col())


class Setting(SQLModel, table=True):
    key: str = Field(primary_key=True)
    value: str
