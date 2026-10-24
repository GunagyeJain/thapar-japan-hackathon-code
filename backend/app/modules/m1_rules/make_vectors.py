"""Write shared/rules/vectors.json: every diet x typical dishes, plus edge cases.

The Python engine produces the expected answers; PINNED below holds the ones we checked by
hand, and the script refuses to write if the engine disagrees with any of them. pytest and
vitest both replay the file, so server and offline tablet must agree on every case.

    cd backend && python -m app.modules.m1_rules.make_vectors
"""

import json

from app.modules.m1_rules.engine import RULES_DIR, combine_presets, evaluate, rules

DISHES = {
    "paneer_butter_masala": ["paneer", "butter", "cream", "tomato", "onion", "garlic", "ginger", "spice"],
    "chicken_tikka_masala": ["chicken", "yogurt", "cream", "tomato", "onion", "garlic", "ginger", "spice"],
    "jain_thali": ["paneer", "rice", "wheat", "lentil", "tomato", "cumin", "ghee"],
    "safe_backup": ["paneer", "green_pea", "rice", "cumin", "ghee", "tomato"],
    "vegan_chana_masala": ["chickpea", "tomato", "onion", "garlic", "ginger", "rice"],
    "aloo_paratha": ["potato", "wheat", "butter", "chili"],
    "dal_tadka": ["lentil", "onion", "garlic", "ghee", "cumin", "turmeric"],
    "egg_curry": ["egg", "onion", "tomato", "spice"],
    "fish_curry": ["fish", "onion", "tomato", "chili"],
    "mutton_biryani": ["mutton", "rice", "yogurt", "onion", "ghee"],
    "halal_chicken_rice": ["chicken", "rice", "halal_certified"],
    "pork_ramen": ["pork_extract", "wheat", "egg", "leek"],
    "teriyaki_chicken": ["chicken", "soy_sauce", "mirin", "sugar"],
    "miso_soup": ["味噌", "出汁", "ねぎ"],
    "kombu_tofu": ["昆布だし", "soy", "soy_sauce"],
    "consomme_soup": ["コンソメ", "carrot", "onion"],
    "veg_stir_fry_oyster_sauce": ["オイスターソース", "cabbage", "carrot"],
    "mushroom_risotto": ["mushroom", "rice", "butter", "cheese", "wine"],
    "panna_cotta": ["cream", "gelatin", "sugar"],
    "gulab_jamun": ["milk", "wheat", "sugar", "ghee"],
    "fruit_bowl_honey": ["banana", "apple", "orange", "honey"],
    "kuttu_puri": ["buckwheat", "potato", "ghee", "salt"],
    "sabudana_khichdi": ["sabudana", "peanut", "potato", "ghee"],
    "veg_sushi": ["rice", "nori", "cucumber", "sugar"],
    "meat_curry_unspecified": ["meat", "onion", "tomato"],
}

COMBOS = {
    "jain+diabetic": ["jain", "diabetic"],
    "vegetarian+no_onion_garlic": ["vegetarian", "no_onion_garlic"],
    "halal+diabetic": ["halal", "diabetic"],
}

PINNED = {
    ("jain", "paneer_butter_masala"): "UNSAFE",
    ("jain", "jain_thali"): "SAFE",
    ("jain", "safe_backup"): "SAFE",
    ("jain_no_dairy", "jain_thali"): "UNSAFE",
    ("jain+diabetic", "gulab_jamun"): "UNSAFE",
    ("jain+diabetic", "safe_backup"): "SAFE",
    ("vegetarian", "miso_soup"): "UNSAFE",
    ("vegetarian", "consomme_soup"): "UNSAFE",
    ("vegetarian", "veg_stir_fry_oyster_sauce"): "UNSAFE",
    ("vegetarian", "panna_cotta"): "UNSAFE",
    ("vegetarian", "paneer_butter_masala"): "SAFE",
    ("vegetarian+no_onion_garlic", "paneer_butter_masala"): "UNSAFE",
    ("vegan", "kombu_tofu"): "SAFE",
    ("vegan", "fruit_bowl_honey"): "UNSAFE",
    ("halal", "halal_chicken_rice"): "SAFE",
    ("halal", "chicken_tikka_masala"): "NEEDS_HUMAN",
    ("halal", "teriyaki_chicken"): "UNSAFE",
    ("vrat", "kuttu_puri"): "SAFE",
    ("vrat", "sabudana_khichdi"): "NEEDS_HUMAN",
    ("vrat", "aloo_paratha"): "UNSAFE",
    ("no_beef", "meat_curry_unspecified"): "NEEDS_HUMAN",
    ("no_beef", "chicken_tikka_masala"): "SAFE",
    ("eggetarian", "egg_curry"): "SAFE",
    ("gluten_free", "kombu_tofu"): "UNSAFE",
    ("diabetic", "teriyaki_chicken"): "UNSAFE",
}


def subjects():
    r = rules()
    for diet_id, diet in r.diets.items():
        yield diet_id, diet["forbid"]
    for name, presets in COMBOS.items():
        yield name, combine_presets(presets)["forbid"]


def build():
    cases = []
    for subject, forbid in subjects():
        for dish, tags in DISHES.items():
            result = evaluate(forbid, tags)
            pinned = PINNED.get((subject, dish))
            if pinned and pinned != result["verdict"]:
                raise SystemExit(f"{subject} x {dish}: engine says {result['verdict']}, pinned {pinned}")
            cases.append({"id": f"{subject}/{dish}", "forbid": forbid, "tags": tags, "expect": result})
    return {"version": rules().version, "count": len(cases), "evaluate": cases}


def main():
    vectors = build()
    out = RULES_DIR / "vectors.json"
    lines = ",\n    ".join(json.dumps(c, ensure_ascii=False) for c in vectors["evaluate"])
    out.write_text(
        f'{{\n  "version": "{vectors["version"]}",\n  "count": {vectors["count"]},\n  "evaluate": [\n    {lines}\n  ]\n}}\n',
        encoding="utf-8",
        newline="\n",
    )
    print(f"wrote {vectors['count']} vectors to {out}")


if __name__ == "__main__":
    main()
