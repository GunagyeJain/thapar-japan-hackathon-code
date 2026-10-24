"""m16 tables."""
from sqlmodel import Field, SQLModel


class TripLeg(SQLModel, table=True):
    """One flight of a passenger's trip. Only whether it's a fast day is stored, never which fast."""

    id: str = Field(primary_key=True)  # TL-…
    passenger_id: str = Field(index=True)
    flight_no: str
    date: str = Field(index=True)  # local departure date, ISO
    origin: str
    dest: str
    catered_in: str  # DEL | NRT
    fast_day: bool = False
