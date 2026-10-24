"""The crew package: everything the tablet needs to run the galley check, seat scan and copilot offline."""
import json
import logging
from typing import Any

from sqlmodel import Session, select

from app.core import clock
from app.core.models import Flight, MealItem, MealPromise, MealSpec, Passenger, Profile
from app.core.paths import SHARED_DIR
from app.core.settings import seed_epoch
from app.modules.m1_rules import engine
from app.modules.m8_crew.copilot import build_copilot

log = logging.getLogger(__name__)


def _codes() -> dict[str, Any]:
    return json.loads((SHARED_DIR / "rules" / "codes.json").read_text(encoding="utf-8"))


def ssr_forbid(code: str, note: str | None, codes: dict[str, Any]) -> list[str]:
    """Tags a booked code excludes, plus any the kitchen note adds ("NO ONION NO GARLIC" -> onion, garlic)."""
    excludes = next((c["excludes"] for c in codes["codes"] if c["code"] == code), [])
    from_note = [tag for tag, phrase in codes["note_phrases"].items() if note and phrase in note.upper()]
    return list(dict.fromkeys([*excludes, *from_note]))


def passenger_forbid(session: Session, passengers: list[Passenger]) -> dict[str, dict[str, Any]]:
    """What each passenger must not get: their profile if they have one, else what their booked code excludes."""
    codes = _codes()
    profiles = {p.passenger_id: p for p in session.exec(select(Profile)).all()}
    out: dict[str, dict[str, Any]] = {}
    for p in passengers:
        if p.id in profiles:
            out[p.id] = {"forbid": profiles[p.id].forbid, "source": "profile"}
        elif p.ssr_meal:
            forbid = ssr_forbid(p.ssr_meal, p.ssr_note, codes)
            if forbid:
                out[p.id] = {"forbid": forbid, "source": f"booked {p.ssr_meal}" + (f" · {p.ssr_note}" if p.ssr_note else "")}
    return out


def expected_specials(session: Session, items: list[MealItem]) -> list[str]:
    """Special items assigned to passengers on the latest acknowledged meal list (m7).

    Until m7's MealListVersion exists, every assigned special counts (same items for the seed).
    """
    specials = [i for i in items if i.kind == "special" and i.assigned_passenger_id]
    try:
        from app.modules.m7_caterer.models import MealListVersion  # type: ignore[import-not-found]
    except ImportError:
        return [i.id for i in specials]
    acked = session.exec(
        select(MealListVersion)
        .where(MealListVersion.ack_at.is_not(None))  # type: ignore[union-attr]
        .order_by(MealListVersion.version.desc())  # type: ignore[attr-defined]
    ).first()
    if not acked:
        return [i.id for i in specials]
    on_list = {line["passenger_id"] for line in acked.lines}
    return [i.id for i in specials if i.assigned_passenger_id in on_list]


def build_package(session: Session, flight: Flight) -> dict[str, Any]:
    passengers = list(session.exec(select(Passenger).where(Passenger.flight_id == flight.id)).all())
    promises = list(session.exec(select(MealPromise).where(MealPromise.flight_id == flight.id)).all())
    items = list(session.exec(select(MealItem).where(MealItem.flight_id == flight.id)).all())
    specs = {s.id: s for s in session.exec(select(MealSpec)).all()}
    forbid = passenger_forbid(session, passengers)

    spec_verdicts: dict[str, dict[str, str]] = {}
    for pid, rule in forbid.items():
        spec_verdicts[pid] = {
            sid: engine.evaluate(rule["forbid"], engine.spec_tags(s.tags, s.certified))["verdict"]
            for sid, s in specs.items()
        }
    verdicts = {pid: {i.id: by_spec[i.spec_id] for i in items} for pid, by_spec in spec_verdicts.items()}

    try:
        copilot = build_copilot(session, flight, passengers, items, specs, forbid)
    except Exception:  # the copilot reads modules built in parallel: the v1 package must still download
        log.exception("crew copilot block failed for %s", flight.id)
        copilot = None

    return {
        "flight": flight.model_dump(mode="json"),
        "passengers": [p.model_dump(mode="json") for p in passengers],
        "promises": [p.model_dump(mode="json") for p in promises],
        "items": [i.model_dump(mode="json") for i in items],
        "specs": [s.model_dump(mode="json") for s in specs.values()],
        "verdicts": verdicts,
        "forbid": forbid,
        "expected_specials": expected_specials(session, items),
        "copilot": copilot,
        "rules_version": engine.rules().version,
        "seed_epoch": seed_epoch(session=session),
        "generated_at": clock.now(session=session).isoformat(),
    }
