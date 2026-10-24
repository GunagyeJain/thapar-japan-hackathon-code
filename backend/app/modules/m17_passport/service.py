"""What a passenger eats, on a given date: the one place other modules ask (router, load, copilot, sun)."""
from datetime import date, datetime
from typing import Any

from sqlmodel import Session, select

from app.core.models import MealItem, MealSpec, Passenger, Profile
from app.modules.m1_rules import engine
from app.modules.m17_passport.models import Passport

# Forbids under these roots are religious or ethical rules: never bent. Sugar is medical. Everything else is taste.
HARD_ROOTS = {
    "meat", "seafood", "egg", "gelatin", "alcohol", "allium", "root_veg", "fungi", "honey", "dairy",
    "beef", "pork", "non_halal_meat", "lard", "meat_extract", "grain", "legume",
}
FIRM_ROOTS = {"sugar"}
TIER_ORDER = {"hard": 3, "firm": 2, "soft": 1, "none": 0}


def tier_for(tag: str, allergens: list[str] | tuple = ()) -> str:
    if tag in allergens:
        return "hard"
    ancestors = set(engine.rules().paths(tag))
    if ancestors & HARD_ROOTS:
        return "hard"
    if ancestors & FIRM_ROOTS:
        return "firm"
    return "soft"


def make_rules(forbid, allow=None, allergens=None, *, flex: bool = False, time_rules=None) -> dict[str, Any]:
    allergens = list(allergens or [])
    forbid = list(dict.fromkeys([*forbid, *allergens]))
    return {
        "forbid": forbid,
        "allow": list(allow or []),
        "allergens": allergens,
        "tiers": {t: tier_for(t, allergens) for t in forbid},
        "flex": flex,
        "time_rules": list(time_rules or []),
    }


def strictest(rules: dict[str, Any] | None) -> str:
    """hard | firm | soft | none: the strongest tier among the passenger's rules (what the crew seat map colours)."""
    if not rules or not rules.get("forbid"):
        return "none"
    return max(rules.get("tiers", {}).values() or ["soft"], key=lambda t: TIER_ORDER[t])


def _profile_rules(profile: Profile) -> dict[str, Any]:
    time_rules = []
    if profile.fasting_dates:
        time_rules.append({"id": "TR-1", "kind": "dates", "dates": list(profile.fasting_dates), "preset": "vrat"})
    return make_rules(profile.forbid, profile.allow, profile.allergens, time_rules=time_rules)


def get(session: Session, passenger_id: str) -> Passport | None:
    return session.exec(select(Passport).where(Passport.passenger_id == passenger_id)).first()


def rules_for(session: Session, passenger_id: str) -> dict[str, Any] | None:
    """The passport's rules, else rules derived from a v1 profile, else None (the passenger told us nothing)."""
    passport = get(session, passenger_id)
    if passport is not None:
        return passport.rules
    passenger = session.get(Passenger, passenger_id)
    profile = session.get(Profile, passenger.profile_id) if passenger and passenger.profile_id else None
    if profile is None:
        profile = session.exec(select(Profile).where(Profile.passenger_id == passenger_id)).first()
    return _profile_rules(profile) if profile else None


def _iso(day: date | datetime | str) -> str:
    return day.isoformat()[:10] if not isinstance(day, str) else day[:10]


def rules_on(rules: dict[str, Any], day: date | datetime | str) -> dict[str, Any]:
    """Forbid/allow that apply on one date: date and weekday rules add their preset or extra forbids. Forbid wins."""
    iso = _iso(day)
    weekday = date.fromisoformat(iso).weekday()
    forbid, allow = list(rules.get("forbid", [])), list(rules.get("allow", []))
    active = []
    for rule in rules.get("time_rules", []):
        hit = (rule["kind"] == "dates" and iso in rule.get("dates", [])) or (
            rule["kind"] == "weekday" and weekday in rule.get("weekdays", [])
        )
        if not hit:
            continue
        active.append(rule["id"])
        if rule.get("preset"):
            preset = engine.rules().presets[rule["preset"]]
            forbid += preset["forbid"]
            allow += preset["allow"]
        forbid += rule.get("add_forbid", [])
    r = engine.rules()
    forbid = list(dict.fromkeys(forbid))
    allow = [a for a in dict.fromkeys(allow) if not any(f in r.paths(a) for f in forbid)]
    return {"forbid": forbid, "allow": allow, "time_rules_active": active}


def daylight_rules(session: Session, flight_id: str) -> list[dict[str, Any]]:
    """Passengers on the flight who don't eat between sunset and sunrise (+N min), or fast from dawn to sunset (m21)."""
    out = []
    for pax in session.exec(select(Passenger).where(Passenger.flight_id == flight_id)).all():
        rules = rules_for(session, pax.id) or {}
        for rule in rules.get("time_rules", []):
            if rule["kind"] in ("daylight", "dawn_to_sunset"):
                out.append({"seat": pax.seat, "passenger_id": pax.id,
                            "rule": {"kind": rule["kind"], "after_sunrise_min": rule.get("after_sunrise_min", 0)}})
    return sorted(out, key=lambda r: r["seat"])


def _main_specs(session: Session, flight_id: str, cabin: str) -> list[MealSpec]:
    prefix = f"SPEC-{cabin}-"
    ids = {i.spec_id for i in session.exec(select(MealItem).where(MealItem.flight_id == flight_id, MealItem.kind == "main")).all()}
    return [s for s in (session.get(MealSpec, i) for i in sorted(ids)) if s and s.id.startswith(prefix)]


def plan_for(session: Session, passenger: Passenger, rules: dict[str, Any], day: date | str | None = None) -> dict[str, Any]:
    """What this passenger needs on this flight: a main-menu dish to hold for them, or a special-meal code + note."""
    flight_day = day or passenger.flight_id.rsplit("-", 1)[-1]
    if isinstance(flight_day, str) and len(flight_day) == 8 and flight_day.isdigit():
        flight_day = f"{flight_day[:4]}-{flight_day[4:6]}-{flight_day[6:]}"
    today = rules_on(rules, flight_day)
    safe_mains = [
        s for s in _main_specs(session, passenger.flight_id, passenger.cabin)
        if engine.evaluate(today["forbid"], engine.spec_tags(s.tags, s.certified))["verdict"] == "SAFE"
    ]
    if not today["forbid"]:
        return {"main_pick": None, "code": None, "kitchen_note": None, "any_main": True, **today}
    if safe_mains:
        return {"main_pick": safe_mains[0].id, "code": None, "kitchen_note": None, "any_main": len(safe_mains) > 1, **today}
    options = engine.code_options(today["forbid"], today["allow"])
    best = options[0] if options else None
    return {
        "main_pick": None,
        "code": best["code"] if best else "SPML",
        "kitchen_note": best["kitchen_note"] if best else None,
        "any_main": False,
        **today,
    }


def rules_card(rules: dict[str, Any] | None) -> dict[str, str]:
    """Short card for crew: what this passenger can't eat, Japanese first. Food rules only, never a diet name."""
    if not rules or not rules.get("forbid"):
        return {"ja": "制限なし", "en": "No food rules", "hi": "कोई नियम नहीं"}
    mark = engine.label_mark(rules["forbid"], rules.get("allow"))
    lines = {k: mark[k] for k in ("ja", "en", "hi")}
    for rule in rules.get("time_rules", []):
        if rule["kind"] == "daylight":
            n = rule.get("after_sunrise_min", 0)
            lines["ja"] += f"／日没後〜日の出{n}分後まで飲食なし"
            lines["en"] += f" / nothing from sunset until {n} min after sunrise"
            lines["hi"] += f" / सूर्यास्त से सूर्योदय के {n} मिनट बाद तक कुछ नहीं"
        elif rule["kind"] == "dawn_to_sunset":
            lines["ja"] += "／夜明けから日没まで飲食なし"
            lines["en"] += " / nothing from dawn until sunset"
            lines["hi"] += " / भोर से सूर्यास्त तक कुछ नहीं"
    return lines


def cabin(session: Session, flight_id: str) -> list[dict[str, Any]]:
    """Every passenger on the flight with what we know: rules (or None), strongest tier, flex, source."""
    out = []
    for pax in session.exec(select(Passenger).where(Passenger.flight_id == flight_id)).all():
        passport = get(session, pax.id)
        rules = passport.rules if passport else rules_for(session, pax.id)
        out.append({
            "passenger_id": pax.id, "seat": pax.seat, "cabin": pax.cabin,
            "name": f"{pax.given.title()} {pax.surname.title()}",
            "known": rules is not None, "source": passport.source if passport else ("profile" if rules else None),
            "tier": strictest(rules), "flex": bool(rules and rules.get("flex")), "rules": rules,
        })
    return sorted(out, key=lambda p: (int("".join(c for c in p["seat"] if c.isdigit())), p["seat"]))
