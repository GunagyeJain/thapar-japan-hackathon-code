"""The router's view of one change: flight, passenger, their rules on the flight date, and shared lookups."""
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

from sqlmodel import Session, select

from app.core.models import Flight, MealItem, MealSpec, Passenger, Profile
from app.modules.m1_rules import engine
from app.modules.m17_passport import service as passport
from app.modules.m18_changes.models import NoShow

USABLE = ("planned", "loaded")
TIER_ORDER = passport.TIER_ORDER
NO_RULES_MARK = {"en": "no food rules", "hi": "कोई नियम नहीं", "ja": "制限なし"}


@dataclass
class Ctx:
    session: Session
    flight: Flight
    passenger: Passenger | None
    kind: str
    channel: str
    at: datetime
    window: str
    rules: dict[str, Any]  # the full Rules (forbid, allow, allergens, tiers, flex, time_rules)
    day: dict[str, Any]  # rules_on(rules, flight date): forbid, allow, time_rules_active
    tiers: dict[str, str]  # tier per forbidden tag on the flight date
    strict: list[str]  # hard and firm tags: an item must be SAFE for every one of them
    tier: str  # strongest tier of the need: hard | firm | soft | none
    lang: str
    note: str | None
    change_id: str
    mark: dict[str, str] = field(default_factory=dict)
    rows: tuple[int, int] | None = None  # a run-out: the trolley's rows

    @property
    def seat(self) -> str:
        return self.passenger.seat if self.passenger else "—"


def row_of(seat: str) -> int:
    return int("".join(c for c in seat if c.isdigit()) or 0)


def service_key(p: Passenger) -> tuple[int, int, str]:
    """Business rows first, then economy front to back; within a row, A to K."""
    return (0 if p.cabin == "C" else 1, row_of(p.seat), p.seat[-1])


def galley_for(seat: str) -> str:
    """Galley 1 serves business and rows up to 29, galley 2 rows 30 and behind (as the seeded specials are loaded)."""
    return "G1" if row_of(seat) < 30 else "G2"


def display_name(p: Passenger) -> str:
    return p.display_name or f"{p.given.title()} {p.surname.title()}"


def tier_of(rules: dict[str, Any], tag: str) -> str:
    return (rules.get("tiers") or {}).get(tag) or passport.tier_for(tag, rules.get("allergens") or [])


def strictest(tiers: dict[str, str]) -> str:
    return max(tiers.values(), key=lambda t: TIER_ORDER[t], default="none")


def day_rules(rules: dict[str, Any], flight: Flight) -> tuple[dict[str, Any], dict[str, str], list[str]]:
    """(rules on the flight date, tier per tag, hard and firm tags)."""
    day = passport.rules_on(rules, flight.date) if rules else {"forbid": [], "allow": [], "time_rules_active": []}
    tiers = {t: tier_of(rules, t) for t in day["forbid"]}
    return day, tiers, [t for t in day["forbid"] if tiers[t] in ("hard", "firm")]


def mark_for(day: dict[str, Any]) -> dict[str, str]:
    return engine.label_mark(day["forbid"], day["allow"]) if day["forbid"] else NO_RULES_MARK


def verdict(spec: MealSpec, forbid: list[str]) -> dict[str, Any]:
    return engine.evaluate(forbid, engine.spec_tags(spec.tags, spec.certified))


def fits(spec: MealSpec | None, forbid: list[str]) -> bool:
    """SAFE for every tag in `forbid`. Never UNSAFE, never NEEDS_HUMAN."""
    return spec is not None and verdict(spec, forbid)["verdict"] == engine.SAFE


def fired_text(spec: MealSpec, forbid: list[str]) -> dict[str, str]:
    """Why a spec fails, in each language: the first two rules that fired."""
    fired = [f["message"] for f in verdict(spec, forbid)["fired"]][:2]
    return {lang: ("、" if lang == "ja" else ", ").join(m.get(lang) or m["en"] for m in fired) or "—"
            for lang in ("en", "hi", "ja")}


def held_items(session: Session, passenger_id: str) -> list[MealItem]:
    rows = session.exec(select(MealItem).where(MealItem.assigned_passenger_id == passenger_id)).all()
    return sorted((i for i in rows if i.status in USABLE), key=lambda i: (i.kind != "special", i.position))


def spec_of(session: Session, item: MealItem | None) -> MealSpec | None:
    return session.get(MealSpec, item.spec_id) if item else None


def no_show_ids(session: Session, flight_id: str) -> set[str]:
    return set(session.exec(select(NoShow.passenger_id).where(NoShow.flight_id == flight_id)).all())


def passenger_lang(session: Session, passenger: Passenger | None, asked: str | None) -> str:
    if asked:
        return asked
    if passenger is None:
        return "en"
    pp = passport.get(session, passenger.id)
    if pp and pp.lang in ("en", "hi", "ja"):
        return pp.lang
    profile = session.get(Profile, passenger.profile_id) if passenger.profile_id else None
    return profile.lang if profile and profile.lang in ("en", "hi", "ja") else "en"


def rules_from_code(code: str, note: str | None) -> dict[str, Any]:
    """Food rules read off a booked code and its note (a request that dropped before we knew the person)."""
    r = engine.rules()
    families = set(r.preference_groups) | {t for base in r.label_bases for t in base["requires"]} | {"beef", "pork", "gelatin"}
    excludes = [t for t in r.codes.get(code, {}).get("excludes", []) if t in families]
    from_note = [tag for tag, phrase in r.note_phrases.items() if note and phrase in note.upper()]
    return passport.make_rules(list(dict.fromkeys([*excludes, *from_note])))


def normalize(given: dict[str, Any]) -> dict[str, Any]:
    """Rules sent by a desk or the chat: tiers filled in from the rules engine where the sender left them out."""
    rules = passport.make_rules(given.get("forbid", []), given.get("allow", []), given.get("allergens", []),
                                flex=bool(given.get("flex")), time_rules=given.get("time_rules", []))
    return {**rules, "tiers": {**rules["tiers"], **(given.get("tiers") or {})}}
