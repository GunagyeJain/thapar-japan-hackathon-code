"""m7 seed: meal lists v1 (at the T-25 h cutoff) and v2, both acknowledged, with their caterer inbox lines."""
from datetime import datetime

from sqlmodel import Session

from app.core.clock import IST
from app.core.models import Notification
from app.core.seed import FLIGHT_ID
from app.modules.m7_caterer.models import MealListVersion
from app.modules.m7_caterer.service import build_lines, diff_lines, sha256_of

CATERER = "Skyline Flight Kitchens · shift lead"
V1_AT, V1_ACK = datetime(2026, 10, 24, 3, 35, tzinfo=IST), datetime(2026, 10, 24, 4, 6, tzinfo=IST)
V2_AT, V2_ACK = datetime(2026, 10, 24, 22, 40, tzinfo=IST), datetime(2026, 10, 24, 22, 51, tzinfo=IST)
# Between the two lists the travel agent added the free-text note to 2A's VJML (a CHG in the ADL).
NOTE_ADDED_AFTER_CUTOFF = "DIABETIC"


def seed(session: Session) -> None:
    v2_lines = build_lines(session, FLIGHT_ID)
    v1_lines = [{**line, "note": None} if line["note"] == NOTE_ADDED_AFTER_CUTOFF else line for line in v2_lines]
    for n, lines, prev, at, acked in ((1, v1_lines, [], V1_AT, V1_ACK), (2, v2_lines, v1_lines, V2_AT, V2_ACK)):
        session.add(
            MealListVersion(
                id=f"ML-JL740-V{n}",
                flight_id=FLIGHT_ID,
                version=n,
                created_at=at,
                sha256=sha256_of(lines),
                ack_at=acked,
                ack_by=CATERER,
                lines=lines,
                diff=diff_lines(prev, lines),
            )
        )
        session.add(
            Notification(
                id=f"NT-ML-V{n}",
                channel="caterer",
                to="caterer",
                title=f"Meal list v{n} received {at:%H:%M}",
                body=f"{len(lines)} special meals" + (" · 1 change since v1" if n == 2 else ""),
                at=at,
                ref={"meal_list_id": f"ML-JL740-V{n}", "version": n},
            )
        )
