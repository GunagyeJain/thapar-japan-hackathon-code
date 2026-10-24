"""m22 table: the seat-screen question for one passenger on one flight, and their answer. New table only."""
from datetime import datetime

from sqlmodel import Field, SQLModel

from app.core.db import TZDateTime


class SeatAsk(SQLModel, table=True):
    """Asked when the crew press "Ask seats now"; answered on the seat screen (or never: the crew ask in person)."""

    id: str = Field(primary_key=True)  # SA-…
    flight_id: str = Field(index=True)
    passenger_id: str = Field(index=True)
    seat: str
    round: int  # which press of "Ask seats now" asked it last
    asked_at: datetime = Field(sa_type=TZDateTime)
    status: str = "asked"  # asked | confirmed | skipped | changed ("no answer" is asked and older than NO_ANSWER)
    answered_at: datetime | None = Field(default=None, sa_type=TZDateTime)
    held: str = "special"  # special: a meal item held for the seat · main: the main course the passport plan holds
    item_id: str | None = None  # the tray held when asked (a main is picked from the trolley, so it may be None)
    spec_id: str | None = None
    new_item_id: str | None = None  # Change: the tray they took instead
    released_item_id: str | None = None  # No or Change: the tray now free for someone else on board
