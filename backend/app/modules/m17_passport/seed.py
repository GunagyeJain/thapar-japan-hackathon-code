"""Who has told us what on JL740, before the story starts. Deterministic, so every reset gives the same cabin.

- Passengers with a special meal (SSR) or a cast profile: a passport converted from it.
- About half of the rest filled in the T-48 h meal form (mix based on Pew 2021 and a share of Japanese travellers).
- The others have told us nothing: the silent majority that m19 forecasts.
Priya (23C) and Mehta (31K) have no passport: Priya makes hers live in Act 1, Mehta asks at the gate.
Swati (30C) has none either: she tells check-in she's diabetic (Chaos Mode).
"""
import random

from sqlmodel import Session, select

from app.core import clock
from app.core.models import Passenger, Profile
from app.modules.m1_rules import engine
from app.modules.m17_passport.models import Passport
from app.modules.m17_passport.service import make_rules

NO_PASSPORT = {"PX-0057", "PX-0122", "PX-0109"}
CODE_PRESETS = {"VJML": ["jain"], "AVML": ["vegetarian"], "VGML": ["vegan"], "VLML": ["eggetarian"], "MOML": ["halal"]}

# (weight, presets, extra forbid, flex-eligible)
CHAT_MIX = [
    (30, ["no_beef"], [], True),
    (22, ["vegetarian"], [], False),
    (6, ["vegetarian", "no_onion_garlic"], [], False),
    (6, ["eggetarian"], [], False),
    (8, ["halal"], [], False),
    (2, ["vegan"], [], False),
    (4, ["no_beef", "diabetic"], [], False),
    (18, [], [], True),  # no rules: mostly Japanese and other travellers
    (4, [], ["peanut"], True),
]
FLEX_SHARE = 0.3
SEED = 740


def _passport(pid: str, rules: dict, source: str, lang: str, now) -> Passport:
    return Passport(id=f"PP-{pid[3:]}", passenger_id=pid, lang=lang, rules=rules, source=source,
                    label_mark=engine.label_mark(rules["forbid"], rules["allow"]) if rules["forbid"] else {}, updated_at=now)


def _from_presets(presets: list[str], extra: list[str] | None = None, **kw) -> dict:
    combined = engine.combine_presets(presets) if presets else {"forbid": [], "allow": []}
    allergens = [t for t in (extra or []) if t in ("peanut", "sesame", "tree_nut")]
    return make_rules(combined["forbid"], combined["allow"], allergens, **kw)


def seed(session: Session) -> None:
    """Add this module's demo rows. Runs after m0 on every reset; add rows, don't commit."""
    now = clock.now(session=session)
    rng = random.Random(SEED)
    pax = sorted(session.exec(select(Passenger).where(Passenger.is_judge == False)).all(), key=lambda p: p.id)  # noqa: E712
    profiles = {p.passenger_id: p for p in session.exec(select(Profile)).all()}
    group_jains = [p.id for p in pax if p.group and p.ssr_meal == "VJML"]
    chauvihar = {"PX-0007", *group_jains[:3]}
    pool = []
    for p in pax:
        if p.id in NO_PASSPORT:
            continue
        if p.seat == "29H":  # Meena keeps a fast on 25 Oct (the flight date): vegetarian, vrat on that day
            rules = _from_presets(["vegetarian"], time_rules=[{"id": "TR-1", "kind": "dates", "dates": ["2026-10-25"], "preset": "vrat"}])
            session.add(_passport(p.id, rules, "ssr", "hi", now))
        elif p.id in profiles:
            prof = profiles[p.id]
            time_rules = [{"id": "TR-1", "kind": "daylight", "after_sunrise_min": 48}] if p.id in chauvihar else []
            rules = make_rules(prof.forbid, prof.allow, prof.allergens, time_rules=time_rules)
            session.add(_passport(p.id, rules, "ssr", prof.lang or "en", now))
        elif p.ssr_meal in CODE_PRESETS:
            time_rules = [{"id": "TR-1", "kind": "daylight", "after_sunrise_min": 48}] if p.id in chauvihar else []
            session.add(_passport(p.id, _from_presets(CODE_PRESETS[p.ssr_meal], time_rules=time_rules), "ssr", "hi", now))
        else:
            pool.append(p)
    rng.shuffle(pool)
    answered = pool[: len(pool) // 2]
    weights = [w for w, *_ in CHAT_MIX]
    for i, p in enumerate(answered):
        _, presets, extra, flexible = rng.choices(CHAT_MIX, weights=weights)[0]
        time_rules = []
        if i == 0:  # a weekday vow: vegetarian on Sundays (25 Oct 2026 is a Sunday)
            presets, flexible = ["no_beef"], False
            time_rules = [{"id": "TR-1", "kind": "weekday", "weekdays": [6], "preset": "vegetarian"}]
        elif i == 1:  # keeps Purnima fasts (25 Oct 2026 is Sharad Purnima)
            presets, flexible = ["vegetarian"], False
            time_rules = [{"id": "TR-1", "kind": "dates", "dates": ["2026-10-25", "2026-11-24", "2026-12-23"], "preset": "vrat"}]
        flex = flexible and rng.random() < FLEX_SHARE
        lang = "ja" if not presets and not extra and rng.random() < 0.6 else rng.choice(["en", "hi"])
        session.add(_passport(p.id, _from_presets(presets, extra, flex=flex, time_rules=time_rules), "form", lang, now))
