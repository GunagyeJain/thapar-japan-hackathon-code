"""How many reserve meals to load: the newsvendor rule, for a fresh spare and for a retort pouch.

Late hard needs per flight ~ Poisson(λ), λ = base × the day's factors (m6's festival table, plus fast days).
Load q* = F⁻¹(Cu / (Cu + Co)): the smallest q that covers the late needs with probability Cu / (Cu + Co).
A fresh spare that nobody eats is thrown away (Co = its cost); a pouch that nobody eats flies again
(Co = carrying it one sector), so the ratio climbs and almost every late need gets covered.
"""
from datetime import date

from app.modules.m6_matcher.forecast import EVENTS
from app.modules.m19_load import assumptions as A
from app.modules.m19_load.stats import leftover_and_short, poisson_cdf, poisson_quantile

POINT = {
    "en": "Because an unused pouch flies again, the airline can afford to cover almost every late request.",
    "hi": "बिना इस्तेमाल हुआ पाउच अगली उड़ान में फिर जाता है, इसलिए एयरलाइन लगभग हर देर से आए अनुरोध को पूरा कर सकती है।",
    "ja": "使われなかったパウチは次の便でまた使えるので、直前のリクエストをほぼすべてカバーできます。",
}
FORMULA = {
    "en": "q* = F⁻¹(Cu / (Cu + Co)): load the smallest number q for which P(late needs ≤ q) is at least Cu / (Cu + Co).",
    "hi": "q* = F⁻¹(Cu / (Cu + Co)): सबसे छोटा q, जिसके लिए P(देर से आई ज़रूरतें ≤ q) कम से कम Cu / (Cu + Co) हो।",
    "ja": "q* = F⁻¹(Cu / (Cu + Co))：P(直前の要望 ≤ q) が Cu / (Cu + Co) 以上になる最小の q を積む。",
}


def day_factors(day: date) -> list[dict]:
    """The factors on late hard needs for this date: m6's festival or group factor, then fast days m6 doesn't list."""
    out = []
    if day in EVENTS:
        factor, label = EVENTS[day]
        out.append({"label": label, "factor": factor, "source": "m6 festival table"})
    if day in A.FAST_DAYS:
        factor, label = A.FAST_DAYS[day]
        out.append({"label": label, "factor": factor, "source": "public calendar"})
    return out


def late_lambda(day: date) -> tuple[float, list[dict]]:
    factors = day_factors(day)
    lam = A.LATE_HARD_PER_FLIGHT
    for f in factors:
        lam *= f["factor"]
    return lam, factors


def newsvendor(lam: float, cost_under: float, cost_over: float, *, wasted: bool) -> dict:
    """q* and what it costs per flight. `wasted`: an unused unit is thrown away (fresh) rather than flown again (pouch)."""
    ratio = cost_under / (cost_under + cost_over)
    q = poisson_quantile(lam, ratio)
    leftover, short = leftover_and_short(lam, q)
    return {
        "q": q,
        "cu": cost_under,
        "co": cost_over,
        "ratio": round(ratio, 4),
        "covered": round(poisson_cdf(lam, q), 4),
        "expected_unused": round(leftover, 2),
        "expected_waste": round(leftover, 2) if wasted else 0.0,
        "expected_short": round(short, 3),
        "cost_per_flight": round(cost_over * leftover + cost_under * short),
    }


def reserve(day: date, loaded: int) -> dict:
    lam, factors = late_lambda(day)
    return {
        "lambda": round(lam, 3),
        "base": A.LATE_HARD_PER_FLIGHT,
        "factors": factors,
        "fresh": newsvendor(lam, A.COST_UNDER_INR, A.COST_OVER_FRESH_INR, wasted=True),
        "pouch": newsvendor(lam, A.COST_UNDER_INR, A.COST_OVER_POUCH_INR, wasted=False),
        "loaded": loaded,
        "loaded_covered": round(poisson_cdf(lam, loaded), 4),
        "formula": FORMULA,
        "point": POINT,
    }
