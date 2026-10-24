"""Every number m19 assumes, in one place. /ops/load prints them as assumptions, with their source.

Replace them with a season of JL740 data when there is one; nothing else in the module hard-codes a number.
"""
from datetime import date

# ---------------------------------------------------------------- reserve (newsvendor)
LATE_HARD_PER_FLIGHT = 1.8  # late hard-tier needs per JL740 flight on an ordinary day
COST_UNDER_INR = 35_000  # a passenger with a strict rule left ~7 h without a meal: 2013 Delhi consumer-commission award against JAL
COST_OVER_FRESH_INR = 450  # one fresh special meal loaded and thrown away unused
COST_OVER_POUCH_INR = 20  # carrying one retort pouch for a sector where nobody needs it; it flies again
POUCH_SHELF_LIFE_MONTHS = 12

# Fast days m6's festival table doesn't list yet: date -> (factor on late hard needs, label).
FAST_DAYS: dict[date, tuple[float, dict[str, str]]] = {
    date(2026, 10, 25): (1.25, {"en": "Sharad Purnima (fast day)", "hi": "शरद पूर्णिमा (व्रत)", "ja": "シャラド・プールニマー（断食日）"}),
}

# ---------------------------------------------------------------- forecast for passengers who told us nothing
INDIAN_SHARE = 0.62  # share of JL740 passengers who are Indian travellers (route assumption)
# Diet families of Indian travellers on this route. Based on Pew Research Center 2021 ("Religion in India"):
# 39% of Indian adults are vegetarian, 81% limit meat in some way, 92% of Jains and 8% of Muslims are vegetarian;
# the split between the families is ours.
INDIAN_MIX = {
    "non_veg": 0.08, "no_beef": 0.38, "halal": 0.10, "vegetarian": 0.25, "veg_no_onion_garlic": 0.04,
    "jain": 0.02, "vegan": 0.01, "eggetarian": 0.06, "fasting": 0.0, "diabetic": 0.04, "allergy": 0.02,
}
# Japanese and other travellers: mostly no food rules.
OTHER_MIX = {"non_veg": 0.93, "vegetarian": 0.02, "halal": 0.01, "allergy": 0.04}
FAST_DAY_SHARE = 0.03  # Indian travellers who keep the fast when the flight is on a fast day
NB_SIZE = 8.0  # negative-binomial size k: how much a family's share moves from flight to flight (variance = μ + μ²/k)
SERVICE_QUANTILE = 0.9  # p90: the demand we plan for

# ---------------------------------------------------------------- sealed-cup spares
# Mix of the late hard needs a standard veg tray can't serve as it is.
LATE_MIX = {"jain": 0.30, "vrat": 0.30, "vegan": 0.15, "no_onion_garlic": 0.25}


def assumption_rows(flight_day: date) -> list[dict]:
    """The assumptions as the screen lists them."""
    fast = FAST_DAYS.get(flight_day)
    rows = [
        ("late_hard", "Late hard-tier needs per flight (ordinary day)", f"{LATE_HARD_PER_FLIGHT}", "Assumption"),
        ("cost_under", "Cost of a strict-rule passenger left without a meal", f"₹{COST_UNDER_INR:,}",
         "2013 Delhi consumer-commission award against JAL"),
        ("cost_fresh", "Cost of a fresh special meal thrown away", f"₹{COST_OVER_FRESH_INR}", "Assumption"),
        ("cost_pouch", "Cost of carrying an unused retort pouch one sector", f"₹{COST_OVER_POUCH_INR}",
         f"Assumption; {POUCH_SHELF_LIFE_MONTHS}-month shelf life, so it flies again"),
        ("indian_share", "Indian travellers on JL740", f"{INDIAN_SHARE:.0%}", "Route assumption"),
        ("indian_mix", "Diet families of Indian travellers", "vegetarian 25%, no beef 38%, halal 10% …",
         "Based on Pew Research Center 2021; split is an assumption"),
        ("other_mix", "Japanese and other travellers with no food rules", f"{OTHER_MIX['non_veg']:.0%}", "Assumption"),
        ("nb_size", "Flight-to-flight spread (negative binomial k)", f"{NB_SIZE:g}", "Assumption"),
    ]
    if fast:
        rows.append(("fast_day", f"Late needs on {fast[1]['en']}", f"× {fast[0]:g}", "Public calendar; factor is an assumption"))
        rows.append(("fast_share", "Indian travellers keeping the fast", f"{FAST_DAY_SHARE:.0%}", "Assumption"))
    return [{"id": i, "label": {"en": label}, "value": value, "source": {"en": source}} for i, label, value, source in rows]
