"""Demand per diet family: what passports tell us (m17), plus a forecast for the passengers who told us nothing.

- known: passengers whose rules on the flight date put them in the family (a weekday or fast-day rule counts that day).
- forecast: known + the unknown passengers spread by the route prior (assumptions.py).
- p90: known + the 90th percentile of the unknown part (negative binomial: shares move from flight to flight).
- loaded: meals on board for them if they're served last: their own special meals, the main dishes left after
  everyone else in their cabin has picked (each passenger picks evenly among the dishes that suit them), and the
  spares and reserve pouches that suit them. Every "suits" is m1's evaluate() returning SAFE.
"""
from collections import Counter, defaultdict
from datetime import date
from math import floor

from sqlmodel import Session, select

from app.core.models import Flight, MealItem, MealSpec
from app.modules.m1_rules import engine
from app.modules.m6_matcher.inventory import USABLE_STATUS, menu_cabin
from app.modules.m17_passport import service as passport
from app.modules.m19_load import assumptions as A
from app.modules.m19_load.stats import nb_quantile

# (id, label, presets for the family's rules, tier) in display order.
FAMILIES: list[tuple[str, dict, list[str], str]] = [
    ("non_veg", {"en": "Non-veg, no rules", "hi": "मांसाहारी, कोई नियम नहीं", "ja": "制限なし"}, [], "none"),
    ("no_beef", {"en": "No beef", "hi": "गोमांस नहीं", "ja": "牛肉なし"}, ["no_beef"], "hard"),
    ("halal", {"en": "Halal", "hi": "हलाल", "ja": "ハラール"}, ["halal"], "hard"),
    ("vegetarian", {"en": "Vegetarian", "hi": "शाकाहारी", "ja": "ベジタリアン"}, ["vegetarian"], "hard"),
    ("veg_no_onion_garlic", {"en": "Veg, no onion-garlic", "hi": "शाकाहारी, बिना प्याज़-लहसुन", "ja": "ベジ・玉ねぎにんにくなし"},
     ["vegetarian", "no_onion_garlic"], "hard"),
    ("jain", {"en": "Jain", "hi": "जैन", "ja": "ジャイナ"}, ["jain"], "hard"),
    ("vegan", {"en": "Vegan", "hi": "वीगन", "ja": "ヴィーガン"}, ["vegan"], "hard"),
    ("eggetarian", {"en": "Eggetarian", "hi": "अंडा-शाकाहारी", "ja": "卵可ベジ"}, ["eggetarian"], "hard"),
    ("fasting", {"en": "Fasting today (vrat)", "hi": "आज व्रत", "ja": "本日断食"}, ["vrat"], "hard"),
    ("diabetic", {"en": "Diabetic", "hi": "मधुमेह", "ja": "糖尿病"}, ["diabetic"], "firm"),
    ("allergy", {"en": "Allergies", "hi": "एलर्जी", "ja": "アレルギー"}, [], "hard"),
]
FAMILY_IDS = [f[0] for f in FAMILIES]
MIN_CABIN_DEMAND = 0.5  # a cabin's dishes count for a family only if the family is expected there


def family_of(forbid: list[str], allergens: list[str]) -> str:
    """The family a passenger's rules on the day put them in: the strictest one that applies."""
    paths = engine.rules().paths
    banned = set(forbid)

    def no(tag: str) -> bool:
        return any(a in banned for a in paths(tag))

    checks = [
        ("fasting", no("grain") and no("legume")),
        ("jain", no("root_veg") and no("onion") and no("meat")),
        ("vegan", no("meat") and no("egg") and no("dairy")),
        ("veg_no_onion_garlic", no("onion") and no("garlic")),
        ("vegetarian", no("meat") and no("egg")),
        ("eggetarian", no("meat")),
        ("halal", "non_halal_meat" in banned or no("pork")),
        ("diabetic", no("sugar")),
        ("allergy", bool(allergens)),
        ("no_beef", no("beef")),
    ]
    return next((fid for fid, hit in checks if hit), "non_veg")


def prior(day: date) -> dict[str, float]:
    """Share of each family among passengers who told us nothing (sums to 1)."""
    indian = dict(A.INDIAN_MIX)
    if day in A.FAST_DAYS:
        indian = {f: s * (1 - A.FAST_DAY_SHARE) for f, s in indian.items()}
        indian["fasting"] = indian.get("fasting", 0.0) + A.FAST_DAY_SHARE
    return {f: A.INDIAN_SHARE * indian.get(f, 0.0) + (1 - A.INDIAN_SHARE) * A.OTHER_MIX.get(f, 0.0) for f in FAMILY_IDS}


def _family_forbid(presets: list[str], fid: str, allergens: list[str]) -> list[str]:
    if fid == "allergy":
        return allergens or ["peanut"]
    return engine.combine_presets(presets)["forbid"] if presets else []


def _cabin_census(rows: list[dict], day: date, holders: set[str]):
    """Known passengers by (cabin, family), those without a held meal, unknown ones, and allergens we were told."""
    known, known_free, unknown_free = Counter(), Counter(), Counter()
    family_by_pid, allergens, unknown = {}, [], 0
    for row in rows:
        free = row["passenger_id"] not in holders
        if not row["known"]:
            unknown += 1
            unknown_free[row["cabin"]] += free
            continue
        today = passport.rules_on(row["rules"], day)
        fam = family_of(today["forbid"], row["rules"].get("allergens", []))
        family_by_pid[row["passenger_id"]] = fam
        known[(row["cabin"], fam)] += 1
        known_free[(row["cabin"], fam)] += free
        allergens += [a for a in row["rules"].get("allergens", []) if fam == "allergy" and a not in allergens]
    return known, known_free, unknown_free, unknown, family_by_pid, allergens


def _left_after_others(dishes: dict[str, int], safe: dict, demand: dict[str, float], fid: str) -> float:
    """Dishes that suit `fid` and are still there after every other family took its expected share."""
    options = {g: [s for s in dishes if safe[(g, s)]] for g in demand}
    taken = defaultdict(float)
    for g, d in demand.items():
        if g != fid and options[g]:
            for s in options[g]:
                taken[s] += d / len(options[g])
    return sum(max(0.0, n - taken[s]) for s, n in dishes.items() if safe[(fid, s)])


def families(session: Session, flight: Flight) -> dict:
    day = date.fromisoformat(flight.date)
    rows = passport.cabin(session, flight.id)
    items = session.exec(select(MealItem).where(MealItem.flight_id == flight.id)).all()
    specs = {s.id: s for s in session.exec(select(MealSpec)).all()}
    holders = {i.assigned_passenger_id for i in items if i.assigned_passenger_id}
    known, known_free, unknown_free, unknown, family_by_pid, allergens = _cabin_census(rows, day, holders)
    share = prior(day)
    forbid = {fid: _family_forbid(presets, fid, allergens) for fid, _, presets, _ in FAMILIES}

    open_items = [i for i in items if i.assigned_passenger_id is None and i.status in USABLE_STATUS and i.spec_id in specs]
    spec_ids = {i.spec_id for i in open_items}
    safe = {(f, s): engine.evaluate(forbid[f], engine.spec_tags(specs[s].tags, specs[s].certified))["verdict"] == engine.SAFE
            for f in FAMILY_IDS for s in spec_ids}
    dishes = {c: Counter(i.spec_id for i in open_items if i.kind in ("main", "spare") and menu_cabin(i.spec_id) == c)
              for c in ("C", "Y")}
    buffer = [i for i in open_items if i.kind in ("spare", "backup") and menu_cabin(i.spec_id) is None]
    demand = {c: {f: known_free[(c, f)] + unknown_free[c] * share[f] for f in FAMILY_IDS} for c in ("C", "Y")}

    out = []
    for fid, label, _, tier in FAMILIES:
        n_known = known[("C", fid)] + known[("Y", fid)]
        mean_unknown = unknown * share[fid]
        own = sum(1 for i in items if family_by_pid.get(i.assigned_passenger_id or "") == fid)
        mains = sum(_left_after_others(dishes[c], safe, demand[c], fid) for c in ("C", "Y") if demand[c][fid] >= MIN_CABIN_DEMAND)
        spare = sum(1 for i in buffer if safe[(fid, i.spec_id)])
        p90 = n_known + nb_quantile(mean_unknown, A.NB_SIZE, A.SERVICE_QUANTILE)
        loaded = own + floor(mains) + spare
        out.append({
            "family": fid, "label": label, "tier": tier, "known": n_known,
            "forecast": round(n_known + mean_unknown, 1), "p90": p90, "loaded": loaded,
            "loaded_from": {"special": own, "main": floor(mains), "spare": spare},
            "risk": p90 > loaded, "share": round(share[fid], 4),
        })
    return {"passengers": len(rows), "known": len(rows) - unknown, "unknown": unknown, "families": out}
