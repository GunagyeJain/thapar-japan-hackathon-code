"""shared/rules/*.json is consistent: every referenced tag exists and presets match their diets."""

import json

import pytest

from app.modules.m1_rules.engine import RULES_DIR

FROZEN_CORE_TAGS = (
    "meat beef pork chicken mutton seafood fish bonito shellfish egg dairy milk ghee paneer butter "
    "cream cheese yogurt allium onion garlic root_veg potato carrot ginger radish honey gelatin lard "
    "meat_extract alcohol mirin sake grain wheat rice legume peanut tree_nut sesame soy buckwheat sugar "
    "halal_certified"
).split()


def load(name):
    return json.loads((RULES_DIR / f"{name}.json").read_text(encoding="utf-8"))


@pytest.fixture(scope="module")
def data():
    return {n: load(n) for n in ("taxonomy", "diets", "presets", "codes")}


@pytest.fixture(scope="module")
def tag_ids(data):
    return {t["id"] for t in data["taxonomy"]["tags"]}


def referenced_tags(data):
    """(where, tag) for every tag id the data files point at."""
    for t in data["taxonomy"]["tags"]:
        if t["parent"]:
            yield f"taxonomy {t['id']}.parent", t["parent"]
        for a in t.get("also", []):
            yield f"taxonomy {t['id']}.also", a
    for d in data["diets"]["diets"]:
        for field in ("forbid", "allow"):
            for tag in d.get(field, []):
                yield f"diet {d['id']}.{field}", tag
    for p in data["presets"]["presets"]:
        for field in ("forbid", "allow"):
            for tag in p[field]:
                yield f"preset {p['id']}.{field}", tag
    for g in data["presets"]["picker_groups"]:
        for tag in g["tags"]:
            yield f"picker_group {g['id']}", tag
    codes = data["codes"]
    for c in codes["codes"]:
        for field in ("excludes", "may_contain", "contains"):
            for tag in c[field]:
                yield f"code {c['code']}.{field}", tag
    for tag in codes["note_phrases"]:
        yield "note_phrases", tag
    for tag in codes["preference_groups"]:
        yield "preference_groups", tag
    for b in codes["label_bases"]:
        for tag in b["requires"] + b["implies"]:
            yield f"label_base {b['id']}", tag


def test_every_referenced_tag_exists(data, tag_ids):
    missing = [(where, tag) for where, tag in referenced_tags(data) if tag not in tag_ids]
    assert missing == []


def test_frozen_core_tags_are_kept(tag_ids):
    assert [t for t in FROZEN_CORE_TAGS if t not in tag_ids] == []


def test_tag_ids_unique_and_labelled(data):
    tags = data["taxonomy"]["tags"]
    ids = [t["id"] for t in tags]
    assert len(ids) == len(set(ids))
    assert len(ids) >= 90
    assert [t["id"] for t in tags if not (t["labels"].get("en") and t["labels"].get("ja"))] == []


def test_taxonomy_has_no_cycles(data):
    tags = {t["id"]: t for t in data["taxonomy"]["tags"]}
    for start in tags:
        seen, node = set(), start
        while node:
            assert node not in seen, f"cycle at {start}"
            seen.add(node)
            node = tags[node]["parent"]


def test_synonyms_point_at_one_tag(data):
    owner = {}
    clashes = []
    for t in data["taxonomy"]["tags"]:
        for word in t["synonyms_ja"] + [w.lower() for w in t["synonyms_en"]]:
            if word in owner and owner[word] != t["id"]:
                clashes.append((word, owner[word], t["id"]))
            owner.setdefault(word, t["id"])
    assert clashes == []


def test_hidden_ingredient_words_are_mapped(data):
    words = {w for t in data["taxonomy"]["tags"] for w in t["synonyms_ja"]}
    needed = "出汁 だし 鰹節 かつお節 煮干し 昆布 みりん 酒 ゼラチン ラード チキンエキス ポークエキス ビーフエキス 魚醤 オイスターソース 卵 乳 バター はちみつ 玉ねぎ にんにく 生姜 じゃがいも 人参 大根".split()
    assert [w for w in needed if w not in words] == []


def test_japan_28_allergens(data):
    classes = [t.get("allergen_jp") for t in data["taxonomy"]["tags"] if t.get("allergen_jp")]
    assert classes.count("mandatory") == 8
    assert classes.count("recommended") == 20
    allergen_groups = [g for g in data["presets"]["picker_groups"] if g["kind"] == "allergen"]
    assert len(allergen_groups) == 28


def test_every_preset_maps_to_its_diet(data):
    diets = {d["id"]: d for d in data["diets"]["diets"]}
    presets = data["presets"]["presets"]
    assert len(presets) == 10
    for p in presets:
        diet = diets[p["diet"]]
        assert p["forbid"], p["id"]
        assert (p["forbid"], p["allow"]) == (diet["forbid"], diet.get("allow", [])), p["id"]
        assert p["labels"].get("hi") and p["labels"].get("ja"), p["id"]


def test_hindi_on_diets_presets_and_picker_groups(data):
    for item in data["diets"]["diets"] + data["presets"]["presets"] + data["presets"]["picker_groups"]:
        assert item["labels"].get("hi"), item["id"]


def test_the_twelve_jal_codes(data):
    codes = [c["code"] for c in data["codes"]["codes"]]
    assert sorted(codes) == sorted("AVML HNML VJML VLML VGML MOML DBML LSML GFML NLML BLML FPML".split())
