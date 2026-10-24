"""Sealed-cup thali-bento spares: the fewest spare cups that turn standard veg trays into safe ones.

A standard veg tray is five sealed cups. For each late need (Jain, vrat, vegan, no onion-garlic) the rules engine
says which standard cups fail. Greedy set cover then picks spare cups from a small catalogue, most late needs
covered first, until every failing (need, cup) pair has a safe swap. A cup that serves several needs is stocked
for their pooled demand (p90 of the summed Poisson rates), which takes fewer cups than stocking each need apart.
"""
from app.modules.m1_rules import engine
from app.modules.m19_load import assumptions as A
from app.modules.m19_load.stats import poisson_quantile

SLOTS = ["base", "main", "side", "curd", "sweet"]
SLOT_LABELS = {"base": "Base", "main": "Main", "side": "Side", "curd": "Curd", "sweet": "Sweet"}

# (id, slot, name, tags, standard): the standard tray first, then the alternative cups.
CUPS: list[tuple[str, str, dict, list[str], bool]] = [
    ("STD-BASE", "base", {"en": "Jeera rice", "hi": "जीरा राइस", "ja": "ジーラライス"}, ["rice", "cumin", "ghee"], True),
    ("STD-MAIN", "main", {"en": "Paneer matar", "hi": "पनीर मटर", "ja": "パニールマタル"},
     ["paneer", "green_pea", "tomato", "onion", "garlic", "ginger"], True),
    ("STD-SIDE", "side", {"en": "Aloo gobi", "hi": "आलू गोभी", "ja": "アルーゴビ"}, ["potato", "cauliflower", "onion", "turmeric"], True),
    ("STD-CURD", "curd", {"en": "Raita", "hi": "रायता", "ja": "ライタ"}, ["yogurt", "cucumber"], True),
    ("STD-SWEET", "sweet", {"en": "Gulab jamun", "hi": "गुलाब जामुन", "ja": "グラブジャムン"}, ["milk", "wheat", "sugar", "ghee"], True),
    ("CUP-SAMAK", "base", {"en": "Samak millet pulao", "hi": "सामक पुलाव", "ja": "サマクのプラオ"}, ["samak", "cumin", "rock_salt"], False),
    ("CUP-RICE", "base", {"en": "Steamed rice", "hi": "सादा चावल", "ja": "白ご飯"}, ["rice"], False),
    ("CUP-MAKHANA", "main", {"en": "Makhana tomato curry", "hi": "मखाना टमाटर करी", "ja": "マカナのトマトカレー"},
     ["makhana", "tomato", "cumin", "rock_salt"], False),
    ("CUP-DAL", "main", {"en": "Lauki chana dal", "hi": "लौकी चना दाल", "ja": "ユウガオとチャナダール"},
     ["bottle_gourd", "chickpea", "tomato", "cumin", "turmeric"], False),
    ("CUP-LAUKI", "side", {"en": "Lauki sabzi", "hi": "लौकी की सब्ज़ी", "ja": "ユウガオのサブジ"}, ["bottle_gourd", "cumin", "rock_salt"], False),
    ("CUP-ALOO", "side", {"en": "Jeera aloo", "hi": "जीरा आलू", "ja": "ジーラアルー"}, ["potato", "cumin", "rock_salt"], False),
    ("CUP-KACHUMBER", "curd", {"en": "Cucumber kachumber", "hi": "खीरे का कचूमर", "ja": "きゅうりのカチュンバル"},
     ["cucumber", "tomato", "rock_salt"], False),
    ("CUP-FRUIT", "sweet", {"en": "Fruit cup", "hi": "फलों का कप", "ja": "フルーツカップ"}, ["apple", "banana", "orange"], False),
    ("CUP-KHEER", "sweet", {"en": "Makhana kheer", "hi": "मखाना खीर", "ja": "マカナのキール"}, ["makhana", "milk", "sugar"], False),
]

# Late needs a standard veg tray can't serve as it is: (id, label, presets).
NEEDS: list[tuple[str, dict, list[str]]] = [
    ("jain", {"en": "Jain", "hi": "जैन", "ja": "ジャイナ"}, ["jain"]),
    ("vrat", {"en": "Fasting (vrat)", "hi": "व्रत", "ja": "断食"}, ["vrat"]),
    ("vegan", {"en": "Vegan", "hi": "वीगन", "ja": "ヴィーガン"}, ["vegan"]),
    ("no_onion_garlic", {"en": "No onion, no garlic", "hi": "बिना प्याज़-लहसुन", "ja": "玉ねぎ・にんにくなし"}, ["vegetarian", "no_onion_garlic"]),
]
DESIGN = {
    "en": "Each cup is sealed on its own, so a swap never touches another dish.",
    "hi": "हर कप अलग से सील है, इसलिए एक कप बदलने से दूसरा व्यंजन नहीं छूता।",
    "ja": "カップは一つずつ密封されているので、交換しても他の料理に触れません。",
}


def _safe(forbid: list[str], tags: list[str]) -> bool:
    return engine.evaluate(forbid, tags)["verdict"] == engine.SAFE


def _cup(cup: tuple, needs: list[tuple[str, dict, list[str]]]) -> dict:
    cid, slot, name, tags, standard = cup
    safe_for = [nid for nid, _, forbid in needs if _safe(forbid, tags)]
    return {"id": cid, "slot": slot, "name": name, "tags": tags, "standard": standard, "safe_for": safe_for}


def _greedy_cover(failing: dict, lam: dict, options: list[dict]) -> list[tuple[dict, list[str]]]:
    """Pick cups until every failing (need, slot) has a safe swap; each pick covers the most late needs left."""
    open_pairs = {(n, s) for n, slots in failing.items() for s in slots}
    picks = []
    while open_pairs:
        def gain(cup):
            return sum(lam[n] for n in cup["safe_for"] if (n, cup["slot"]) in open_pairs)

        best = max(options, key=gain)  # ties keep catalogue order
        if gain(best) <= 0:
            break
        covered = [n for n in best["safe_for"] if (n, best["slot"]) in open_pairs]
        open_pairs -= {(n, best["slot"]) for n in covered}
        picks.append((best, covered))
    return picks


def bento_plan(late_lambda: float) -> dict:
    needs = [(nid, label, engine.combine_presets(presets)["forbid"]) for nid, label, presets in NEEDS]
    lam = {nid: late_lambda * A.LATE_MIX[nid] for nid, _, _ in needs}
    cups = [_cup(c, needs) for c in CUPS]
    standard = {c["slot"]: c for c in cups if c["standard"]}
    failing = {nid: [s for s in SLOTS if nid not in standard[s]["safe_for"]] for nid, _, _ in needs}
    picks = _greedy_cover(failing, lam, [c for c in cups if not c["standard"]])
    level = A.SERVICE_QUANTILE
    spares = [
        {"cup_id": cup["id"], "slot": cup["slot"], "name": cup["name"], "covers": covered,
         "lambda": round(sum(lam[n] for n in covered), 3), "count": poisson_quantile(sum(lam[n] for n in covered), level)}
        for cup, covered in picks
    ]
    apart = sum(poisson_quantile(lam[n], level) for n, slots in failing.items() for _ in slots)
    total = sum(s["count"] for s in spares)
    return {
        "slots": [{"id": s, "label": {"en": SLOT_LABELS[s]}} for s in SLOTS],
        "tray": [standard[s] for s in SLOTS],
        "components": cups,
        "needs": [{"id": nid, "label": label, "lambda": round(lam[nid], 3), "fails": failing[nid]} for nid, label, _ in needs],
        "spares": spares,
        "total_cups": total,
        "cups_if_stocked_apart": apart,
        "design": DESIGN,
    }
