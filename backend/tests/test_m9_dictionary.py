"""m9 dictionary pass and verdicts on the four demo sheets, with no model at all."""
from pathlib import Path

import pytest

from app.modules.m9_recipes import gemini
from app.modules.m9_recipes.dictionary import read_sheet, scan
from app.modules.m9_recipes.pipeline import dictionary_only

SHEETS = Path(__file__).resolve().parents[2] / "shared" / "seed" / "recipes"


def sheet(name: str) -> dict:
    return dictionary_only((SHEETS / f"{name}.txt").read_text(encoding="utf-8"))


def verdict(result: dict, diet: str) -> dict:
    return next(v for v in result["verdicts"] if v["diet"] == diet)


def vias(v: dict) -> list[str]:
    return [f["via"] for f in v["fired"]]


def test_longest_word_wins():
    assert scan("玉ねぎ") == [("玉ねぎ", "onion")]
    assert scan("昆布だし") == [("昆布だし", "kombu")]
    assert scan("ただし、出汁は鰹節") == [("出汁", "bonito"), ("鰹節", "bonito")]


def test_miso_soup_dashi_is_fish():
    miso = sheet("miso_soup")
    assert miso["dish_name_ja"] == "味噌汁"
    for diet in ("vegetarian", "jain"):
        v = verdict(miso, diet)
        assert v["verdict"] == "UNSAFE"
        assert any(x.startswith("出汁 → bonito → fish") for x in vias(v))


def test_curry_roux_hides_pork():
    curry = sheet("vegetable_curry")
    assert verdict(curry, "vegetarian")["verdict"] == "UNSAFE"
    roux = next(r for r in curry["ingredients"] if r["name_ja"] == "カレールウ")
    assert {"lard", "pork_extract"} <= set(roux["tags"])
    # One rule per forbidden family: pork shows once, through the first word that hit it.
    assert [v for v in vias(verdict(curry, "halal")) if "pork" in v] == ["ラード → lard → pork"]
    assert any(v.startswith("ラード → lard") for v in vias(verdict(curry, "vegetarian")))


def test_kitsune_udon_mirin_and_bonito_but_kombu_is_fine():
    udon = sheet("kitsune_udon")
    assert any(v.startswith("鰹節 → bonito → fish") for v in vias(verdict(udon, "vegetarian")))
    assert any(v.startswith("みりん → mirin → alcohol") for v in vias(verdict(udon, "halal")))
    assert not any("昆布" in v for d in udon["verdicts"] for v in vias(d))


def test_tempura_batter_egg():
    tempura = sheet("vegetable_tempura")
    assert any(v.startswith("卵 → egg") for v in vias(verdict(tempura, "vegan")))
    assert verdict(tempura, "vegetarian")["verdict"] == "UNSAFE"


def test_unknown_ingredient_goes_to_a_person():
    # わかめ isn't in the taxonomy: the dictionary can't clear it.
    rows = read_sheet("材料\n・わかめ 4g\n・水 600ml\n")["ingredients"]
    assert [r["name_ja"] for r in rows] == ["わかめ"]
    result = dictionary_only("材料\n・わかめ 4g\n")
    assert verdict(result, "vegan")["verdict"] == "NEEDS_HUMAN"


@pytest.fixture
def fresh(client, monkeypatch):
    # Never call Gemini from tests, even when .env has a key.
    def offline(**_):
        raise gemini.ModelUnavailable("tests run offline")

    monkeypatch.setattr(gemini, "extract", offline)
    client.post("/api/demo/reset", json={"keep_judges": False})


def test_extract_and_approve_over_http(client, fresh):
    text = (SHEETS / "miso_soup.txt").read_text(encoding="utf-8")
    res = client.post("/api/recipes/extract", json={"text": text})
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["engine"] == "dictionary" and body["status"] == "needs_review"
    assert body["name"] == {"en": "Miso soup", "ja": "味噌汁"}
    assert "words" not in body["ingredients"][0]

    approved = client.post(f"/api/recipes/{body['id']}/approve", json={"by": "Skyline QA"}).json()
    assert approved["sheet"]["status"] == "approved"
    spec = approved["spec"]
    assert spec["source"] == "recipe_check" and "bonito" in spec["tags"]
    assert client.post("/api/rules/evaluate", json={"forbid": ["meat", "seafood", "egg"], "spec_tags": spec["tags"]}).json()["verdict"] == "UNSAFE"

    again = client.post(f"/api/recipes/{body['id']}/approve", json={"by": "Skyline QA"}).json()
    assert again["spec"]["id"] == spec["id"]
    assert [s["id"] for s in client.get("/api/recipes").json()] == [body["id"]]


def test_extract_rejects_empty_text(client, fresh):
    assert client.post("/api/recipes/extract", json={"text": "  "}).status_code == 422


@pytest.mark.parametrize("path", sorted(SHEETS.glob("*.png")) + sorted(SHEETS.glob("*.txt")), ids=lambda p: p.name)
def test_demo_sheets_are_cached_for_offline(path):
    from app.modules.m9_recipes import cache
    from app.modules.m9_recipes.pipeline import source_hash

    assert cache.get(source_hash(path.read_bytes())) is not None, f"run {path.name} through Gemini once and commit the cache"
