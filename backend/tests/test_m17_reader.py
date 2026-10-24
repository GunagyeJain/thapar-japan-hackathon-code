"""m17 dictionary reader: a diet in the passenger's own words → food rules, chips, time rules. No database."""
from app.modules.m1_rules import engine
from app.modules.m17_passport import words
from app.modules.m17_passport.understand import assemble


def read(text: str) -> dict:
    return assemble(words.read(text))


def chips(out: dict, kind: str) -> dict:
    return {c["tag"]: c for c in out["chips"] if c["kind"] == kind}


def forbids(out: dict, tag: str) -> bool:
    return any(f in engine.rules().paths(tag) for f in out["rules"]["forbid"])


def test_priya_hinglish_with_purnima():
    out = read("pure veg, no onion-garlic, aur Purnima ka vrat rakhti hoon")
    rules = out["rules"]
    for tag in ("meat", "seafood", "egg", "onion", "garlic"):
        assert tag in rules["forbid"]
    assert "dairy" in rules["allow"]
    assert rules["tiers"]["onion"] == "hard" and rules["tiers"]["meat"] == "hard"
    (purnima,) = out["time_rules"]
    assert purnima["kind"] == "dates" and purnima["preset"] == "vrat" and purnima["confirm"] is True
    assert "2026-10-25" in purnima["dates"] and "2026-11-24" in purnima["dates"]
    assert purnima["via"] == "Purnima → fasting days" and purnima["label"]["en"] == "Purnima fasts"
    assert "label" not in rules["time_rules"][0] and "via" not in rules["time_rules"][0]
    assert chips(out, "forbid")["garlic"]["via"] == "onion garlic → garlic"
    assert out["unclear"] == [] and out["source"] == "dictionary"


def test_jain_with_milk_allowed():
    out = read("main Jain hoon par doodh chalega")
    jain = engine.combine_presets(["jain"])
    assert set(jain["forbid"]) <= set(out["rules"]["forbid"])
    assert "dairy" in out["rules"]["allow"]
    assert chips(out, "allow")["milk"]["via"] == "doodh → milk"
    assert out["presets"] == ["jain"]


def test_hindi_egg_yes_fish_no():
    out = read("मैं अंडा खाता हूँ पर मछली नहीं")
    assert "egg" in out["rules"]["allow"]
    assert "fish" in out["rules"]["forbid"] and "egg" not in out["rules"]["forbid"]


def test_chicken_but_never_beef_or_pork():
    out = read("I eat chicken but never beef or pork")
    assert {"beef", "pork"} <= set(out["rules"]["forbid"])
    assert "chicken" in out["rules"]["allow"] and not forbids(out, "chicken")


def test_halal_no_alcohol():
    out = read("halal please, no alcohol")
    assert {"pork", "non_halal_meat", "alcohol"} <= set(out["rules"]["forbid"])
    assert out["rules"]["tiers"]["alcohol"] == "hard"


def test_vegan_peanut_allergy_is_hard():
    out = read("vegan, allergic to peanuts")
    assert out["rules"]["allergens"] == ["peanut"]
    assert "peanut" in out["rules"]["forbid"] and out["rules"]["tiers"]["peanut"] == "hard"
    assert chips(out, "allergen")["peanut"]["via"] == "peanuts → peanut"
    assert "dairy" in out["rules"]["forbid"]


def test_japanese_no_meat_no_fish():
    out = read("肉と魚は食べません")
    assert {"meat", "seafood"} <= set(out["rules"]["forbid"])


def test_chauvihar_jain_daylight_48():
    out = read("chauvihar karta hoon, Jain")
    assert "allium" in out["rules"]["forbid"]
    (daylight,) = out["rules"]["time_rules"]
    assert daylight == {"id": "TR-1", "kind": "daylight", "after_sunrise_min": 48}


def test_anything_is_fine_is_flex_with_no_rules():
    out = read("anything is fine")
    assert out["rules"]["forbid"] == [] and out["rules"]["flex"] is True and out["unclear"] == []


def test_flex_only_without_hard_rules():
    assert read("vegetarian, but anything is fine otherwise")["rules"]["flex"] is False
    assert read("flexible, prefer no mushrooms")["rules"]["flex"] is True


def test_soft_wording_and_diabetic_tiers():
    out = read("diabetic, prefer no mushrooms")
    tiers = out["rules"]["tiers"]
    assert tiers["sugar"] == "firm" and tiers["honey"] == "firm" and tiers["mushroom"] == "soft"


def test_unknown_words_are_unclear_not_guessed():
    out = read("no sabudana, no onion")
    assert out["unclear"] == ["sabudana"] and out["rules"]["forbid"] == ["onion"]
    assert read("peanuts")["unclear"] == ["peanuts"]  # no "no" or "OK" anywhere: we don't guess


def test_veg_but_egg_releases_egg():
    out = read("veg hoon, egg chalega")
    assert "egg" in out["rules"]["allow"] and "egg" not in out["rules"]["forbid"]
    assert {"meat", "seafood", "gelatin"} <= set(out["rules"]["forbid"])


def test_weekday_vow_is_a_time_rule_not_every_day():
    out = read("mangalvar ko non-veg nahi")
    assert out["rules"]["forbid"] == []
    (rule,) = out["rules"]["time_rules"]
    assert rule == {"id": "TR-1", "kind": "weekday", "weekdays": [1], "preset": "vegetarian"}
    out = read("I am vegetarian and fast on Tuesdays")
    assert "meat" in out["rules"]["forbid"]
    assert out["rules"]["time_rules"][0]["preset"] == "vrat"


def test_lists_take_the_no_of_their_neighbour():
    assert {"onion", "garlic"} <= set(read("pyaz, lahsun nahi")["rules"]["forbid"])
    assert {"onion", "garlic", "mushroom"} <= set(read("no onion, garlic or mushrooms")["rules"]["forbid"])


def test_japanese_onion_garlic_out_egg_ok():
    out = read("玉ねぎ・にんにく抜き、卵は大丈夫です")
    assert {"onion", "garlic"} <= set(out["rules"]["forbid"]) and "egg" in out["rules"]["allow"]


def test_ramadan_and_sunset_rules():
    roza = read("Ramzan ke roze rakhta hoon")["rules"]["time_rules"]
    assert roza[0]["kind"] == "dawn_to_sunset" and "2027-02-20" in roza[0]["dates"]
    sunrise = read("nothing from sunset until sunrise")["rules"]["time_rules"]
    assert sunrise[0]["kind"] == "daylight" and sunrise[0]["after_sunrise_min"] == 0


def test_nothing_is_inferred_from_a_name():
    # Purnima and Poonam are first names, Jain and Ramzan are names too: a name alone makes no rule.
    assert read("My name is Purnima Jain, vegetarian")["rules"]["time_rules"] == []
    out = read("My name is Purnima Jain, vegetarian")
    assert "meat" in out["rules"]["forbid"] and "allium" not in out["rules"]["forbid"]
    assert read("Sushila Jain here, no onion")["rules"]["forbid"] == ["onion"]
    assert read("mera naam Poonam hai, pure veg")["rules"]["time_rules"] == []
    assert read("Ramzan Ali, no pork")["rules"]["time_rules"] == []
    # ...but a festival with a fast, or "I keep it", is a time rule, also in a list.
    rules = read("I fast on Ekadashi and Purnima")["rules"]["time_rules"]
    assert len(rules) == 2 and all(r["preset"] == "vrat" for r in rules)
    assert read("Ekadashi rakhti hoon")["rules"]["time_rules"][0]["preset"] == "vrat"
    assert read("Ramzan ke roze rakhta hoon")["rules"]["time_rules"][0]["kind"] == "dawn_to_sunset"


def test_the_extraction_model_only_adds():
    nothing = {"forbid": [], "allow": [], "allergens": [], "soft": [], "flex": False}
    out = assemble(words.read("no sabudana"), {**nothing, "forbid": ["grain"], "allergens": ["sesame"]})
    assert out["source"] == "model" and out["rules"]["allergens"] == ["sesame"]
    assert {c["tag"]: c["source"] for c in out["chips"]} == {"grain": "model", "sesame": "model"}
    out = assemble(words.read("pure veg"), {**nothing, "forbid": ["meat", "onion"], "allow": ["egg"]})
    assert out["source"] == "both" and "onion" in out["rules"]["forbid"]
    assert "egg" in out["rules"]["forbid"] and "egg" not in out["rules"]["allow"]  # the model can't loosen a rule
    assert next(c for c in out["chips"] if c["tag"] == "meat")["source"] == "dictionary"


def test_no_diet_name_in_the_rules():
    out = read("main Jain hoon, halal nahi, Purnima ka vrat")
    text = str(out["rules"]).lower().replace("non_halal_meat", "")
    for word in ("jain", "halal", "purnima", "vrat"):
        assert word not in text.replace("'preset': 'vrat'", "")
