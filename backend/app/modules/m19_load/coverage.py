"""The universal-plate table: 13 diet profiles on this route × 5 reserve candidates, every cell from m1's evaluate().

Profiles are m1's presets and diets (food rules, never a person). The universal plate is the live SPEC-BACKUP
spec from the seed, so the table checks what is actually in galley 2.
"""
from sqlmodel import Session

from app.core.models import MealSpec
from app.modules.m1_rules import engine

UNIVERSAL_SPEC = "SPEC-BACKUP"

# (id, label, presets to combine | diet id)
PROFILES: list[tuple[str, dict, list[str] | str]] = [
    ("none", {"en": "No food rules", "hi": "कोई नियम नहीं", "ja": "制限なし"}, []),
    ("no_beef", {"en": "No beef", "hi": "गोमांस नहीं", "ja": "牛肉なし"}, ["no_beef"]),
    ("halal", {"en": "Halal", "hi": "हलाल", "ja": "ハラール"}, ["halal"]),
    ("weekday_veg", {"en": "Vegetarian on vow days", "hi": "व्रत के वार शाकाहारी", "ja": "決まった曜日はベジ"}, ["no_beef", "vegetarian"]),
    ("vegetarian", {"en": "Lacto-vegetarian", "hi": "शाकाहारी (दूध सहित)", "ja": "ラクト・ベジタリアン"}, ["vegetarian"]),
    ("eggetarian", {"en": "Eggetarian (lacto-ovo)", "hi": "अंडा-शाकाहारी", "ja": "卵可ベジタリアン"}, ["eggetarian"]),
    ("vegan", {"en": "Vegan", "hi": "वीगन", "ja": "ヴィーガン"}, ["vegan"]),
    ("no_onion_garlic", {"en": "No onion, no garlic", "hi": "बिना प्याज़-लहसुन", "ja": "玉ねぎ・にんにくなし"}, ["no_onion_garlic"]),
    ("jain", {"en": "Jain, with dairy", "hi": "जैन (दूध सहित)", "ja": "ジャイナ（乳製品可）"}, ["jain"]),
    ("jain_no_dairy", {"en": "Jain, no dairy (VJML)", "hi": "जैन, दूध रहित (VJML)", "ja": "ジャイナ・乳製品なし（VJML）"}, ["jain_no_dairy"]),
    ("vrat", {"en": "Fasting (Navratri, vrat)", "hi": "व्रत (नवरात्रि)", "ja": "断食（ナヴァラートリ等）"}, ["vrat"]),
    ("gluten_free", {"en": "Gluten free", "hi": "ग्लूटेन-मुक्त", "ja": "グルテンフリー"}, "gluten_free"),
    ("peanut_allergy", {"en": "Peanut allergy", "hi": "मूँगफली से एलर्जी", "ja": "落花生アレルギー"}, "allergy_peanut"),
]

# (id, name, tags, halal-certified kitchen) for the candidates that aren't the loaded reserve.
CANDIDATES: list[tuple[str, dict, list[str], bool]] = [
    ("jain_thali", {"en": "Jain thali with dairy", "hi": "जैन थाली (दूध सहित)", "ja": "ジャイナ式ターリー（乳製品入り）"},
     ["rice", "lentil", "paneer", "bottle_gourd", "ghee", "cumin", "turmeric"], False),
    ("vrat_plate", {"en": "Vrat plate: sabudana, potato, peanuts", "hi": "व्रत थाली: साबूदाना, आलू, मूँगफली", "ja": "断食プレート：サブダナ・じゃがいも・落花生"},
     ["tapioca", "potato", "peanut", "ghee", "cumin", "rock_salt"], False),
    ("paneer_rice", {"en": "Paneer curry with rice (AVML style)", "hi": "पनीर करी और चावल (AVML)", "ja": "パニールカレーとご飯（AVML風）"},
     ["paneer", "cream", "tomato", "onion", "garlic", "ginger", "rice", "cumin"], False),
    ("chicken_rice", {"en": "Chicken curry with rice", "hi": "चिकन करी और चावल", "ja": "チキンカレーとご飯"},
     ["chicken", "yogurt", "tomato", "onion", "garlic", "ginger", "rice"], False),
]
UNIVERSAL_FALLBACK = ["samak", "makhana", "bottle_gourd", "rock_salt"]

NOTES = [
    {"en": "Halal passengers may still ask for a certified kitchen; the rules only check the ingredients.",
     "hi": "हलाल यात्री प्रमाणित रसोई भी माँग सकते हैं; नियम केवल सामग्री जाँचते हैं।",
     "ja": "ハラールの方は認証キッチンを求める場合があります。ルールが確認するのは原材料だけです。"},
    {"en": "Diabetic passengers are checked separately (sugar, not the diet family).",
     "hi": "मधुमेह वाले यात्रियों की जाँच अलग से होती है (चीनी)।",
     "ja": "糖尿病の方は別途確認します（糖分）。"},
]


def profile_forbid(source: list[str] | str) -> list[str]:
    if isinstance(source, str):
        return list(engine.rules().diets[source]["forbid"])
    return engine.combine_presets(source)["forbid"] if source else []


def _row(cid: str, name: dict, tags: list[str], certified: bool, *, reserve: bool) -> dict:
    results = [engine.evaluate(profile_forbid(src), engine.spec_tags(tags, certified)) for _, _, src in PROFILES]
    matrix = [r["verdict"] for r in results]
    return {
        "id": cid,
        "name": name,
        "tags": tags,
        "reserve": reserve,
        "covers": matrix.count(engine.SAFE),
        "checks": matrix.count(engine.NEEDS_HUMAN),
        "matrix": matrix,
        "fired": [r["fired"] for r in results],
    }


def universal_table(session: Session) -> dict:
    spec = session.get(MealSpec, UNIVERSAL_SPEC)
    name = spec.name if spec else {"en": "Universal plate"}
    tags = list(spec.tags) if spec else UNIVERSAL_FALLBACK
    rows = [_row("universal", name, tags, bool(spec and spec.certified), reserve=True)]
    rows += [_row(cid, n, t, c, reserve=False) for cid, n, t, c in CANDIDATES]
    return {
        "profiles": [{"id": pid, "label": label} for pid, label, _ in PROFILES],
        "candidates": rows,
        "notes": NOTES,
    }
