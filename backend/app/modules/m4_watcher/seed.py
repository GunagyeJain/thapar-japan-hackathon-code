from sqlmodel import Session, select

from app.core.models import Flight, Passenger

from .parser import render_pnl
from .watcher import ingest


def seed(session: Session) -> None:
    """The PNL as message 1, then reconcile: C2 for the cast's promises, WRONG_CODE for 24A."""
    for flight in session.exec(select(Flight)).all():
        passengers = session.exec(select(Passenger).where(Passenger.flight_id == flight.id, Passenger.is_judge == False)).all()  # noqa: E712
        ingest(render_pnl(flight, passengers), session=session)
