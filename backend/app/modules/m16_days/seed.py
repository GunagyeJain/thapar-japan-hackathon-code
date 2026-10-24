from sqlmodel import Session

from app.modules.m16_days.models import TripLeg

# (passenger, flight_no, date, origin, dest, catered_in, fast_day). Fast days follow shared/rules/calendar.json:
# 5 Nov Rama Ekadashi, 20 Nov Devutthana Ekadashi. Priya's return is not marked: she does that in the demo.
LEGS = [
    ("PX-0057", "JL740", "2026-10-25", "DEL", "NRT", "DEL", False),
    ("PX-0057", "JL749", "2026-11-20", "NRT", "DEL", "NRT", False),
    ("PX-0087", "JL740", "2026-10-25", "DEL", "NRT", "DEL", False),
    ("PX-0087", "JL749", "2026-11-05", "NRT", "DEL", "NRT", True),
    ("PX-0063", "JL740", "2026-10-25", "DEL", "NRT", "DEL", False),
    ("PX-0063", "JL749", "2026-11-05", "NRT", "DEL", "NRT", True),
    ("PX-0007", "JL740", "2026-10-25", "DEL", "NRT", "DEL", False),
    ("PX-0007", "JL749", "2026-11-20", "NRT", "DEL", "NRT", True),
]


def seed(session: Session) -> None:
    """Add this module's demo rows. Runs after m0 on every reset; add rows, don't commit."""
    for pid, flight_no, day, origin, dest, catered_in, fast in LEGS:
        session.add(TripLeg(
            id=f"TL-{pid[3:]}-{flight_no}", passenger_id=pid, flight_no=flight_no, date=day,
            origin=origin, dest=dest, catered_in=catered_in, fast_day=fast,
        ))
