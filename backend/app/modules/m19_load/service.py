"""GET /api/load/{flight_id}: everything /ops/load shows, computed live from the seed, the passports and m1's rules."""
from datetime import date

from sqlmodel import Session, select

from app.core.models import Flight, MealItem
from app.modules.m19_load import assumptions, bento, coverage, demand, reserve

METHOD = {
    "en": (
        "Families: each passenger's food rules on the flight date (m17). Forecast: the passengers who told us nothing, "
        "spread by the route prior. p90: negative binomial on that forecast. On board: meals that m1's rules engine "
        "calls SAFE for the family, counting main dishes left after everyone else in the cabin has picked."
    ),
}


def load_plan(session: Session, flight: Flight) -> dict:
    day = date.fromisoformat(flight.date)
    backups = session.exec(select(MealItem).where(MealItem.flight_id == flight.id, MealItem.kind == "backup")).all()
    res = reserve.reserve(day, loaded=len(backups))
    fam = demand.families(session, flight)
    return {
        "flight_id": flight.id,
        "flight_no": flight.flight_no,
        "date": flight.date,
        **{k: fam[k] for k in ("passengers", "known", "unknown")},
        "families": fam["families"],
        "reserve": res,
        "universal": coverage.universal_table(session),
        "bento": bento.bento_plan(res["lambda"]),
        "assumptions": assumptions.assumption_rows(day),
        "method": METHOD,
    }
