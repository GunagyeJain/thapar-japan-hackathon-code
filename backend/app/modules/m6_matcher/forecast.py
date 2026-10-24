"""How many sealed backups to load per flight: a newsvendor model on late strict-diet requests.

Late requests per flight ~ Poisson(λ), λ = base × weekday × festival or group factor.
Stock the smallest n with P(N ≤ n) ≥ Cu / (Cu + Co), then add the galley reserve.
The factors are illustrative until a season of real late-request data replaces them.
"""
import math
from datetime import date, timedelta

from app.modules.m6_matcher.inventory import BACKUP_RESERVE

BASE_LATE_PER_FLIGHT = 0.5
WEEKDAY = (0.9, 0.85, 0.9, 1.0, 1.15, 1.1, 1.2)  # Monday … Sunday
COST_UNDER_INR = 50_000  # a passenger left with nothing safe: complaint handling, ₹40k–65k court awards
COST_OVER_INR = 2_600  # flying one sealed backup that isn't needed; it flies again (12-month shelf life)
SERVICE_LEVEL = COST_UNDER_INR / (COST_UNDER_INR + COST_OVER_INR)

# date -> (factor, note). Diwali is 8 Nov 2026; the Ekadashi date is approximate.
EVENTS: dict[date, tuple[float, dict]] = {
    date(2026, 10, 25): (1.3, {"en": "Group booking: 12 travellers", "hi": "समूह बुकिंग: 12 यात्री", "ja": "団体予約：12名"}),
    date(2026, 11, 3): (1.3, {"en": "Diwali travel", "hi": "दिवाली यात्रा", "ja": "ディワリの帰省"}),
    date(2026, 11, 4): (1.4, {"en": "Diwali travel", "hi": "दिवाली यात्रा", "ja": "ディワリの帰省"}),
    date(2026, 11, 5): (1.6, {"en": "Ekadashi fast (approx.) · Diwali travel", "hi": "एकादशी व्रत (लगभग) · दिवाली यात्रा", "ja": "エーカーダシー断食（概算）・ディワリの帰省"}),
    date(2026, 11, 6): (1.7, {"en": "Dhanteras", "hi": "धनतेरस", "ja": "ダンテラス"}),
    date(2026, 11, 7): (1.8, {"en": "Choti Diwali", "hi": "छोटी दिवाली", "ja": "チョーティー・ディワリ"}),
    date(2026, 11, 8): (2.0, {"en": "Diwali", "hi": "दिवाली", "ja": "ディワリ"}),
    date(2026, 11, 9): (1.5, {"en": "Govardhan Puja", "hi": "गोवर्धन पूजा", "ja": "ゴーヴァルダン・プージャ"}),
    date(2026, 11, 10): (1.4, {"en": "Bhai Dooj", "hi": "भाई दूज", "ja": "バイ・ドゥージ"}),
}

METHOD = {
    "en": (
        f"Late strict-diet requests per flight follow a Poisson model: base {BASE_LATE_PER_FLIGHT} a flight, "
        "times a weekday factor, times a festival or group factor. We load the smallest number of backups that "
        f"covers the late requests with probability {SERVICE_LEVEL:.2f}: the critical ratio Cu / (Cu + Co), where "
        f"Cu ≈ ₹{COST_UNDER_INR:,} (a passenger left with nothing safe) and Co ≈ ₹{COST_OVER_INR:,} (a sealed "
        f"backup that isn't needed flies again within its 12-month shelf life). Then we add the {BACKUP_RESERVE} kept "
        "for galley contingencies. Factors are illustrative until we have a season of real data."
    ),
    "hi": (
        f"देर से आने वाले विशेष-भोजन अनुरोधों को Poisson मॉडल से गिना जाता है। {SERVICE_LEVEL:.2f} संभावना से उन्हें पूरा करने "
        f"लायक सबसे कम बैकअप, फिर गैली के लिए {BACKUP_RESERVE} और। कारक उदाहरण हैं।"
    ),
    "ja": (
        f"直前の特別食リクエストをポアソン分布で見積もり、確率{SERVICE_LEVEL:.2f}で賄える最小数の予備食に、"
        f"ギャレー非常用の{BACKUP_RESERVE}食を加えます。係数は例示です。"
    ),
}


def poisson_quantile(lam: float, level: float) -> int:
    """Smallest n with P(N <= n) >= level for N ~ Poisson(lam)."""
    n, term = 0, math.exp(-lam)
    cdf = term
    while cdf < level:
        n += 1
        term *= lam / n
        cdf += term
    return n


def forecast(start: date, days: int) -> dict:
    rows = []
    for offset in range(days):
        day = start + timedelta(days=offset)
        factor, note = EVENTS.get(day, (1.0, None))
        lam = BASE_LATE_PER_FLIGHT * WEEKDAY[day.weekday()] * factor
        cover = poisson_quantile(lam, SERVICE_LEVEL)
        row = {
            "date": day.isoformat(),
            "expected_late": round(lam, 2),
            "late_cover": cover,
            "recommended": cover + BACKUP_RESERVE,
        }
        if note:
            row["festival"] = note
        rows.append(row)
    return {"service_level": round(SERVICE_LEVEL, 3), "method": METHOD, "rows": rows, "galley_reserve": BACKUP_RESERVE}
