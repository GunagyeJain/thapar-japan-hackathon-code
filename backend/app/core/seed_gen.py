"""Writes the deterministic demo data in shared/seed/*.json.

    backend/.venv/Scripts/python -m app.core.seed_gen   (Windows; macOS: backend/.venv/bin/python)

Run it from backend/. The output is committed, so ids (PX-, TB-) stay the same on every laptop.
"""
import json
import random
from itertools import cycle

from .paths import SEED_DIR


def presets_rules(preset_ids: list[str]) -> tuple[list[str], list[str]]:
    """forbid/allow exactly as m1 combines the presets, so seeded profiles match the passenger app."""
    from app.modules.m1_rules.engine import combine_presets

    combined = combine_presets(preset_ids)
    return combined["forbid"], combined["allow"]

FLIGHT_ID = "JL740-20261025"
CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"
BUSINESS = {"rows": (1, 5), "letters": "ACDGHK"}
ECONOMY = {"rows": (18, 39), "letters": "ACDEFGHK"}
JUDGE_ROWS = (5, 20)  # held free for POST /api/join
EXTRA_EMPTY_SEATS = 6  # 206 seats - 14 judge seats - 6 = 186 passengers
SEED_CREATED_AT = "2026-10-20T10:00:00+05:30"
PROFILE_EXPIRES_AT = "2026-11-24T23:59:00+05:30"

FLIGHT = {
    "id": FLIGHT_ID,
    "flight_no": "JL740",
    "date": "2026-10-25",
    "origin": "DEL",
    "dest": "NRT",
    "std": "2026-10-25T04:35:00+05:30",
    "sta": "2026-10-25T15:20:00+09:00",
    "aircraft": "B787-8",
    "cabins": {
        "C": {"rows": list(BUSINESS["rows"]), "letters": BUSINESS["letters"], "seats": 30},
        "Y": {"rows": list(ECONOMY["rows"]), "letters": ECONOMY["letters"], "seats": 176},
    },
    "special_meal_cutoff": "2026-10-24T03:35:00+05:30",
    "caterer_final_list_at": "2026-10-25T00:40:00+05:30",
    "dispatch_at": "2026-10-25T02:05:00+05:30",
    "boarding_at": "2026-10-25T03:35:00+05:30",
    "status": "scheduled",
    "delay_min": 0,
    "caterer": "Skyline Flight Kitchens, Delhi",
    "backup_count": 4,
}

# seat: (surname, given, title, pnr, ssr_meal, ssr_note, inbound)
CAST = {
    "23C": ("SHARMA", "PRIYA", "MS", "6XK2QP", "AVML", "NO ONION NO GARLIC",
            {"flight": "6E5318", "from": "BOM", "date": "2026-10-24"}),
    "31K": ("MEHTA", "RAMESH", "MR", None, None, None, None),
    "27D": ("SHAH", "HEMANT", "MR", None, "VJML", None, None),
    "24A": ("VERMA", "ANIL", "MR", None, "HNML", None, None),
    "18C": ("KHAN", "AYESHA", "MS", None, "MOML", None, None),
    "21E": ("IYER", "ROHAN", "MR", None, "VGML", None, None),
    "26G": ("REDDY", "KAVYA", "MS", None, "VLML", "EGGETARIAN", None),
    "29H": ("PATEL", "MEENA", "MRS", None, "AVML", "VRAT", None),
    "2A": ("JAIN", "SUSHILA", "MRS", None, "VJML", "DIABETIC", None),
}
GROUP_NAME = "MANGAL YATRA TOURS"
GROUP_FIRST, GROUP_SIZE = "33D", 12
GROUP_PAX = [
    ("AGARWAL", "MAHESH", "MR"), ("AGARWAL", "SUNITA", "MRS"), ("GOEL", "PRAKASH", "MR"), ("GOEL", "REKHA", "MRS"),
    ("BANSAL", "VINOD", "MR"), ("BANSAL", "ANITA", "MRS"), ("MITTAL", "SURESH", "MR"), ("MITTAL", "KUSUM", "MRS"),
    ("SINGHAL", "RAJESH", "MR"), ("SINGHAL", "POONAM", "MRS"), ("JINDAL", "DINESH", "MR"), ("JINDAL", "SAROJ", "MRS"),
]
EXTRA_SSRS = [("AVML", None), ("AVML", None), ("VGML", None), ("VLML", None)]  # generated passengers, rows 35-39

INDIAN_SURNAMES = ["KUMAR", "SINGH", "GUPTA", "MALHOTRA", "KAPOOR", "CHOPRA", "NAIR", "MENON", "RAO", "DAS",
                   "BOSE", "SEN", "PILLAI", "JOSHI", "DESAI", "KULKARNI", "BHATT", "SAXENA", "ARORA", "SETHI",
                   "CHAUHAN", "YADAV", "MISHRA", "TIWARI", "PANDEY", "GHOSH", "MUKHERJEE", "BANERJEE"]
INDIAN_MALE = ["ARJUN", "VIKRAM", "RAHUL", "AMIT", "SANJAY", "KARAN", "NIKHIL", "ADITYA", "RAJIV", "MANOJ",
               "DEEPAK", "SAURABH", "VARUN", "ANKIT", "HARSH", "KUNAL"]
INDIAN_FEMALE = ["ANANYA", "NEHA", "POOJA", "RIYA", "SNEHA", "DIVYA", "SHREYA", "KAVITA", "ANJALI", "NISHA",
                 "PRIYANKA", "SWATI", "ISHA", "MEERA", "TANVI", "RADHIKA"]
JAPANESE_SURNAMES = ["SATO", "SUZUKI", "TAKAHASHI", "TANAKA", "WATANABE", "ITO", "YAMAMOTO", "NAKAMURA",
                     "KOBAYASHI", "KATO", "YOSHIDA", "YAMADA", "SASAKI", "MATSUMOTO", "INOUE", "KIMURA"]
JAPANESE_MALE = ["HIROSHI", "TAKESHI", "KENJI", "YUTA", "DAIKI", "SHOTA", "RYO", "KAITO", "HARUTO", "SOTA"]
JAPANESE_FEMALE = ["YUKI", "AYAKA", "HARUKA", "MISAKI", "SAKURA", "AOI", "NANAMI", "RIN", "MIYU", "EMI"]
OTHER = [("SMITH", "JAMES", "MR"), ("MÜLLER", "ANNA", "MS"), ("GARCIA", "LUIS", "MR"), ("BROWN", "EMMA", "MS"),
         ("NGUYEN", "LINH", "MS"), ("KIM", "JIHO", "MR"), ("ROSSI", "MARCO", "MR"), ("WILSON", "OLIVIA", "MS")]
INBOUND_FLIGHTS = [("6E2134", "BLR"), ("AI805", "BOM"), ("6E6417", "HYD"), ("AI440", "CCU"), ("6E531", "MAA")]

# Specs: id -> (name_en, name_ja, code, kind, tags, certified)
SPECS = {
    "SPEC-AVML": ("Vegetable biryani, dal tadka, raita", "野菜ビリヤニ、ダルタルカ、ライタ", "AVML", "special",
                  ["rice", "legume", "yogurt", "onion", "garlic", "ginger", "carrot", "sugar"], False),
    "SPEC-AVML-NOG": ("Jeera rice, paneer matar, dal (no onion, no garlic)",
                      "ジーラライス、パニールマタル、ダル（玉ねぎ・にんにく不使用）", "AVML", "special",
                      ["rice", "paneer", "legume", "potato", "ginger"], False),
    "SPEC-AVML-VRAT": ("Sabudana khichdi, jeera aloo, fruit", "サブダナのキチュリ、ジーラアルー、フルーツ", "AVML",
                       "special", ["potato", "peanut", "ghee", "sugar"], False),
    "SPEC-VJML": ("Jain dal, lauki sabzi, steamed rice, phulka", "ジャイナ式ダル、ユウガオのサブジ、ご飯、プルカ",
                  "VJML", "special", ["legume", "rice", "wheat", "ghee"], False),
    "SPEC-VJML-DB": ("Jain low-sugar meal: moong dal, tinda, multigrain phulka",
                     "ジャイナ式低糖食：ムングダル、ティンダ、雑穀プルカ", "VJML", "special",
                     ["legume", "wheat", "ghee"], False),
    "SPEC-HNML": ("Chicken curry with rice", "チキンカレーとご飯", "HNML", "special",
                  ["chicken", "rice", "onion", "garlic", "ginger", "yogurt"], False),
    "SPEC-MOML": ("Halal chicken korma with rice", "ハラール・チキンコルマとご飯", "MOML", "special",
                  ["chicken", "halal_certified", "rice", "cream", "tree_nut", "onion", "garlic", "ginger"], True),
    "SPEC-VGML": ("Chana masala, jeera rice, roti", "チャナマサラ、ジーラライス、ロティ", "VGML", "special",
                  ["legume", "rice", "wheat", "onion", "garlic", "ginger"], False),
    "SPEC-VLML": ("Vegetable frittata, roast potatoes, bread roll", "野菜のフリッタータ、ローストポテト、パン", "VLML",
                  "special", ["egg", "cheese", "milk", "butter", "potato", "onion", "wheat"], False),
    "SPEC-BACKUP": ("Paneer and peas with jeera rice (sealed backup)", "パニールとグリーンピース、ジーラライス（密封予備食）",
                    None, "backup", ["paneer", "legume", "rice", "ghee"], False),
    "SPEC-C-JAIN": ("Jain thali", "ジャイナ式ターリー", None, "main",
                    ["legume", "rice", "wheat", "paneer", "ghee"], False),
    "SPEC-C-CHANA": ("Vegan chana masala with rice", "ヴィーガン・チャナマサラとご飯", None, "main",
                     ["legume", "rice", "onion", "garlic", "ginger"], False),
    "SPEC-C-CHICKEN": ("Chicken biryani", "チキンビリヤニ", None, "main",
                       ["chicken", "rice", "yogurt", "onion", "garlic", "ginger"], False),
    "SPEC-Y-CHICKEN": ("Chicken tikka masala with rice", "チキンティッカマサラとご飯", None, "main",
                       ["chicken", "cream", "butter", "yogurt", "onion", "garlic", "ginger", "rice"], False),
    "SPEC-Y-PANEER": ("Paneer butter masala with rice", "パニールバターマサラとご飯", None, "main",
                      ["paneer", "butter", "cream", "tree_nut", "onion", "garlic", "ginger", "rice"], False),
}
SPEC_FOR_SSR = {("AVML", "NO ONION NO GARLIC"): "SPEC-AVML-NOG", ("AVML", "VRAT"): "SPEC-AVML-VRAT",
                ("VJML", "DIABETIC"): "SPEC-VJML-DB"}
FIXED_ITEM_IDS = {"23C": "TB-7K2Q9F"}  # Priya's tray: the id used in the docs and the deck

VEG = ["meat", "seafood", "egg", "gelatin", "lard", "meat_extract"]
JAIN = VEG + ["allium", "root_veg", "honey"]
# seat: (lang, presets, forbid, allow, fasting_dates, code, kitchen_note, mark_en, mark_hi, mark_ja, detail)
# forbid/allow here document intent; the written profile takes m1's combine_presets(presets).
CAST_PROFILES = {
    "24A": ("hi", ["vegetarian"], VEG, ["dairy"], [], "AVML", None,
            "VEG · no meat, fish or egg", "शाकाहारी · मांस, मछली, अंडा नहीं", "ベジ · 肉・魚・卵なし",
            "Profile saved: vegetarian → AVML"),
    "27D": ("hi", ["jain"], JAIN, ["dairy"], [], "VJML", None,
            "VEG · no root veg, no onion, no garlic", "शाकाहारी · जड़ वाली सब्ज़ी, प्याज़, लहसुन नहीं",
            "ベジ · 根菜・玉ねぎ・にんにくなし", "Profile saved: no meat, egg, root veg, onion, garlic → VJML"),
    "2A": ("hi", ["jain", "diabetic"], JAIN + ["sugar"], ["dairy"], [], "VJML", "DIABETIC",
           "VEG · no root veg, no onion, no garlic · low sugar",
           "शाकाहारी · जड़ वाली सब्ज़ी, प्याज़, लहसुन नहीं · कम चीनी", "ベジ · 根菜・玉ねぎ・にんにくなし · 低糖",
           "Profile saved: Jain rules + low sugar → VJML, note DIABETIC"),
    "18C": ("en", ["halal"], ["pork", "lard", "alcohol", "gelatin"], ["halal_certified"], [], "MOML", None,
            "HALAL · no pork, no alcohol", "हलाल · सूअर का मांस, शराब नहीं", "ハラール · 豚肉・アルコールなし",
            "Profile saved: halal only, no pork or alcohol → MOML"),
    "21E": ("en", ["vegan"], VEG + ["dairy", "honey"], [], [], "VGML", None,
            "VEGAN · no animal products", "वीगन · कोई पशु उत्पाद नहीं", "ヴィーガン · 動物性食品なし",
            "Profile saved: vegan → VGML"),
    "26G": ("en", ["eggetarian"], ["meat", "seafood", "gelatin", "lard", "meat_extract"], ["egg", "dairy"], [],
            "VLML", "EGGETARIAN", "VEG + EGG · no meat, no fish", "शाकाहारी + अंडा · मांस, मछली नहीं",
            "ベジ＋卵 · 肉・魚なし", "Profile saved: eggs OK, no meat or fish → VLML, note EGGETARIAN"),
    "29H": ("hi", ["vegetarian", "vrat"], VEG + ["grain", "legume", "allium"], ["dairy", "potato", "peanut"],
            ["2026-10-25"], "AVML", "VRAT", "FASTING · no grains, no onion, no garlic",
            "व्रत · अनाज, प्याज़, लहसुन नहीं", "断食 · 穀物・玉ねぎ・にんにくなし",
            "Profile saved: fasting on 25 Oct, no grains → AVML, note VRAT"),
}


def code(rng: random.Random, length: int, taken: set[str]) -> str:
    while True:
        c = "".join(rng.choice(CODE_ALPHABET) for _ in range(length))
        if c not in taken:
            taken.add(c)
            return c


def seats(cabin: dict) -> list[str]:
    lo, hi = cabin["rows"]
    return [f"{r}{letter}" for r in range(lo, hi + 1) for letter in cabin["letters"]]


def build_passengers(rng: random.Random) -> list[dict]:
    all_seats = [("C", s) for s in seats(BUSINESS)] + [("Y", s) for s in seats(ECONOMY)]
    order = [s for _, s in all_seats]
    group_start = order.index(GROUP_FIRST)
    group_seats = order[group_start:group_start + GROUP_SIZE]
    reserved = set(CAST) | set(group_seats)
    free = [s for _, s in all_seats if int(s[:-1]) not in JUDGE_ROWS and s not in reserved]
    empty = set(rng.sample([s for s in free if int(s[:-1]) >= 21], EXTRA_EMPTY_SEATS))
    extra_ssr_seats = rng.sample([s for s in free if 35 <= int(s[:-1]) <= 39 and s not in empty], len(EXTRA_SSRS))
    inbound_seats = rng.sample([s for s in free if s not in empty], len(INBOUND_FLIGHTS))

    pnrs = {c[3] for c in CAST.values() if c[3]}
    group_pnr = code(rng, 6, pnrs)
    passengers, n = [], 0
    for cabin, seat in all_seats:
        if int(seat[:-1]) in JUDGE_ROWS or seat in empty:
            continue
        n += 1
        p = {"id": f"PX-{n:04d}", "flight_id": FLIGHT_ID, "seat": seat, "cabin": cabin,
             "ssr_meal": None, "ssr_note": None, "inbound": None, "group": None,
             "is_judge": False, "display_name": None, "profile_id": None}
        if seat in CAST:
            surname, given, title, pnr, ssr, note, inbound = CAST[seat]
            p.update(surname=surname, given=given, title=title, pnr=pnr or code(rng, 6, pnrs),
                     ssr_meal=ssr, ssr_note=note, inbound=inbound)
        elif seat in group_seats:
            surname, given, title = GROUP_PAX[group_seats.index(seat)]
            p.update(surname=surname, given=given, title=title, pnr=group_pnr, ssr_meal="VJML", group=GROUP_NAME)
        else:
            surname, given, title = random_name(rng)
            p.update(surname=surname, given=given, title=title, pnr=code(rng, 6, pnrs))
            if seat in extra_ssr_seats:
                p["ssr_meal"], p["ssr_note"] = EXTRA_SSRS[extra_ssr_seats.index(seat)]
            if seat in inbound_seats:
                flight, origin = INBOUND_FLIGHTS[inbound_seats.index(seat)]
                p["inbound"] = {"flight": flight, "from": origin, "date": "2026-10-24"}
        passengers.append(p)
    return passengers


def random_name(rng: random.Random) -> tuple[str, str, str]:
    roll = rng.random()
    if roll < 0.62:
        surnames, male, female = INDIAN_SURNAMES, INDIAN_MALE, INDIAN_FEMALE
    elif roll < 0.92:
        surnames, male, female = JAPANESE_SURNAMES, JAPANESE_MALE, JAPANESE_FEMALE
    else:
        return rng.choice(OTHER)
    if rng.random() < 0.5:
        return rng.choice(surnames), rng.choice(male), "MR"
    return rng.choice(surnames), rng.choice(female), rng.choice(["MS", "MRS"])


def build_profiles(passengers: list[dict]) -> dict:
    by_seat = {p["seat"]: p for p in passengers}
    profiles, promises, events = [], [], []
    for seat, (lang, presets, _forbid, _allow, fasting, meal_code, note, en, hi, ja, detail) in CAST_PROFILES.items():
        forbid, allow = presets_rules(presets)
        pax = by_seat[seat]
        num = pax["id"][3:]
        pf_id, mp_id = f"PF-{num}", f"MP-{num}"
        pax["profile_id"] = pf_id
        profiles.append({
            "id": pf_id, "passenger_id": pax["id"], "lang": lang, "presets": presets, "forbid": forbid,
            "allow": allow, "fasting_dates": fasting, "allergens": [],
            "consent": {"this_trip": True, "save_profile": False, "share_with_caterer": True,
                        "cross_border_ack": True, "at": SEED_CREATED_AT},
            "created_at": SEED_CREATED_AT, "expires_at": PROFILE_EXPIRES_AT,
        })
        promises.append({
            "id": mp_id, "profile_id": pf_id, "passenger_id": pax["id"], "flight_id": FLIGHT_ID,
            "code": meal_code, "kitchen_note": note, "label_mark": {"en": en, "hi": hi, "ja": ja}, "status": "ok",
            "checkpoints": {"C1": "ok", "C2": "pending", "C3": "pending", "C4": "pending", "C5": "pending"},
        })
        events.append({
            "id": f"CE-{num}C1", "promise_id": mp_id, "passenger_id": pax["id"], "flight_id": FLIGHT_ID,
            "checkpoint": "C1", "result": "ok", "at": SEED_CREATED_AT, "source": "passenger_app",
            "detail": detail, "data": {"code": meal_code}, "key": f"seed:C1:{mp_id}",
        })
    return {"profiles": profiles, "promises": promises, "events": events}


def build_specs() -> list[dict]:
    return [{"id": sid, "name": {"en": en, "ja": ja}, "code": c, "kind": kind, "tags": tags,
             "certified": certified, "source": "caterer"}
            for sid, (en, ja, c, kind, tags, certified) in SPECS.items()]


def galley_for(seat: str) -> str:
    return "G1" if int(seat[:-1]) <= 29 else "G2"


def build_items(rng: random.Random, passengers: list[dict]) -> list[dict]:
    taken = {i[3:] for i in FIXED_ITEM_IDS.values()}
    counters: dict[str, int] = {}
    items: list[dict] = []

    def add(spec_id: str, kind: str, galley: str, passenger_id: str | None = None, seat: str | None = None):
        prefix = {"special": "S", "spare": "X", "backup": "B", "main": "M"}[kind]
        slot = counters[galley + prefix] = counters.get(galley + prefix, 0) + 1
        item_id = FIXED_ITEM_IDS.get(seat or "") or f"TB-{code(rng, 6, taken)}"
        items.append({"id": item_id, "flight_id": FLIGHT_ID, "spec_id": spec_id, "kind": kind, "galley": galley,
                      "position": f"{galley}-{prefix}{slot:02d}", "assigned_passenger_id": passenger_id,
                      "status": "planned"})

    for p in passengers:
        if p["ssr_meal"]:
            spec = SPEC_FOR_SSR.get((p["ssr_meal"], p["ssr_note"]), f"SPEC-{p['ssr_meal']}")
            add(spec, "special", galley_for(p["seat"]), p["id"], p["seat"])
    add("SPEC-VJML", "spare", "G2")
    add("SPEC-AVML", "spare", "G1")
    for _ in range(FLIGHT["backup_count"]):
        add("SPEC-BACKUP", "backup", "G2")
    for spec in ("SPEC-C-JAIN", "SPEC-C-JAIN", "SPEC-C-CHANA", "SPEC-C-CHANA", "SPEC-C-CHICKEN", "SPEC-C-CHICKEN"):
        add(spec, "spare", "G1")
    business_mains = sum(1 for p in passengers if p["cabin"] == "C" and not p["ssr_meal"]) + 2
    for _, spec in zip(range(business_mains), cycle(["SPEC-C-CHICKEN", "SPEC-C-CHANA", "SPEC-C-JAIN"])):
        add(spec, "main", "G1")
    economy_mains = sum(1 for p in passengers if p["cabin"] == "Y" and not p["ssr_meal"]) + 4
    for n, spec in zip(range(economy_mains), cycle(["SPEC-Y-CHICKEN", "SPEC-Y-PANEER"])):
        add(spec, "main", "G1" if n % 4 < 2 else "G2")
    return items


def write(name: str, data) -> None:
    (SEED_DIR / name).write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8", newline="\n")


def main() -> None:
    rng = random.Random(740)
    SEED_DIR.mkdir(parents=True, exist_ok=True)
    passengers = build_passengers(rng)
    profiles = build_profiles(passengers)
    items = build_items(rng, passengers)
    write("flight.json", FLIGHT)
    write("passengers.json", passengers)
    write("profiles.json", profiles)
    write("meal_specs.json", build_specs())
    write("meal_items.json", items)
    specials = sum(1 for p in passengers if p["ssr_meal"])
    print(f"{len(passengers)} passengers, {specials} special meals, {len(items)} items -> {SEED_DIR}")


if __name__ == "__main__":
    main()
