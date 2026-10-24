"""Rules engine: verdicts, code mapper, booking check and label marks for the named cast."""

import pytest

from app.modules.m1_rules.engine import (
    NEEDS_HUMAN,
    SAFE,
    UNSAFE,
    UnknownTagError,
    check_booking,
    code_options,
    combine_presets,
    evaluate,
    evaluate_diet,
    label_mark,
)


def preset(*ids):
    return combine_presets(list(ids))


def test_jain_vs_paneer_with_onion_and_garlic():
    result = evaluate(preset("jain")["forbid"], ["paneer", "tomato", "onion", "garlic"])
    assert result["verdict"] == UNSAFE
    assert [f["via"] for f in result["fired"]] == ["onion → allium", "garlic → allium"]
    assert all(f["message"]["en"] and f["message"]["ja"] and f["message"]["hi"] for f in result["fired"])


def test_plain_vegetarian_dish_is_safe():
    assert evaluate(preset("vegetarian")["forbid"], ["paneer", "green_pea", "rice"]) == {"verdict": SAFE, "fired": []}


def test_dashi_is_fish_via_japanese_word():
    result = evaluate_diet("vegetarian", ["出汁", "kombu"])
    assert result["verdict"] == UNSAFE
    assert result["fired"][0]["via"] == "出汁 → bonito → fish → seafood"
    assert result["fired"][0]["diet"] == "vegetarian"


def test_kombu_dashi_is_safe():
    assert evaluate_diet("vegan", ["昆布だし", "soy_sauce"])["verdict"] == SAFE


def test_unknown_word_needs_a_person():
    result = evaluate(preset("vegetarian")["forbid"], ["paneer", "mystery paste"])
    assert result["verdict"] == NEEDS_HUMAN
    assert result["fired"][0]["rule_id"] == "unknown_tag"


def test_halal_needs_certification():
    forbid = preset("halal")["forbid"]
    assert evaluate(forbid, ["chicken", "rice"])["verdict"] == NEEDS_HUMAN
    assert evaluate(forbid, ["chicken", "rice", "halal_certified"])["verdict"] == SAFE
    assert evaluate(forbid, ["pork", "halal_certified"])["verdict"] == UNSAFE


def test_unsafe_beats_needs_human():
    result = evaluate(preset("halal")["forbid"], ["chicken", "mirin"])
    assert result["verdict"] == UNSAFE
    assert {f["effect"] for f in result["fired"]} == {UNSAFE, NEEDS_HUMAN}


def test_vague_tag_needs_a_person():
    result = evaluate(preset("no_beef")["forbid"], ["meat"])
    assert result["verdict"] == NEEDS_HUMAN
    assert result["fired"][0]["rule_id"] == "unclear.beef"


def test_soy_sauce_is_wheat_and_mirin_is_sugar():
    assert evaluate_diet("gluten_free", ["soy_sauce"])["verdict"] == UNSAFE
    assert evaluate_diet("diabetic", ["みりん"])["verdict"] == UNSAFE


def test_unknown_forbid_tag_is_rejected():
    with pytest.raises(UnknownTagError):
        evaluate(["not_a_tag"], ["rice"])


def test_combined_presets_drop_allows_that_are_forbidden():
    assert preset("jain", "vegan")["allow"] == []
    assert preset("vegetarian", "no_onion_garlic") == {
        "forbid": ["meat", "seafood", "egg", "gelatin", "onion", "garlic"],
        "allow": ["dairy"],
    }


def test_priya_gets_avml_with_note_then_vjml():
    rules = preset("vegetarian", "no_onion_garlic")
    options = code_options(rules["forbid"], rules["allow"])
    first, second = options[0], options[1]
    assert (first["code"], first["recommended"], first["kitchen_note"]) == ("AVML", True, "NO ONION NO GARLIC")
    assert first["label_mark"]["en"] == "VEG · no onion, no garlic"
    assert (second["code"], second["safety_gaps"], second["preference_losses"]) == ("VJML", [], ["dairy", "root_veg"])
    assert [o["recommended"] for o in options].count(True) == 1


def test_api_example_without_gelatin_or_allow():
    options = code_options(["meat", "seafood", "egg", "onion", "garlic"], ["dairy"])
    assert [o["code"] for o in options[:2]] == ["AVML", "VJML"]


def test_verma_booked_on_hnml():
    result = check_booking(preset("vegetarian")["forbid"], "HNML")
    assert result["ok"] is False
    assert result["problem"]["contains"] == ["chicken", "mutton", "fish"]
    assert result["suggested_code"] == "AVML"


def test_priya_booking_is_ok_with_note():
    rules = preset("vegetarian", "no_onion_garlic")
    assert check_booking(rules["forbid"], "AVML") == {"ok": True, "kitchen_note": "NO ONION NO GARLIC"}


def test_no_booking_is_flagged():
    result = check_booking(preset("jain")["forbid"], None)
    assert result["ok"] is False and result["suggested_code"] == "VJML"


@pytest.mark.parametrize(
    ("presets", "code", "note"),
    [
        (["jain"], "VJML", None),
        (["jain", "diabetic"], "VJML", "DIABETIC"),
        (["vegan"], "VGML", "NO HONEY"),
        (["eggetarian"], "VLML", None),
        (["halal"], "MOML", None),
        (["no_beef"], "HNML", None),
        (["vrat"], "AVML", "NO ALCOHOL NO GRAIN NO LENTILS OR BEANS NO ONION NO GARLIC"),
        (["diabetic"], "DBML", None),
    ],
)
def test_cast_gets_the_seeded_code(presets, code, note):
    rules = preset(*presets)
    best = code_options(rules["forbid"], rules["allow"])[0]
    assert (best["code"], best["kitchen_note"]) == (code, note)


def test_label_marks():
    assert label_mark(preset("jain")["forbid"])["en"] == "JAIN"
    assert label_mark(preset("jain_no_dairy")["forbid"])["en"] == "JAIN · no dairy"
    assert label_mark(preset("halal")["forbid"])["en"] == "HALAL"
    assert label_mark(preset("vegetarian", "no_onion_garlic")["forbid"])["ja"] == "ベジ · 玉ねぎなし、にんにくなし"
    assert label_mark(["beef"])["en"] == "no beef"
