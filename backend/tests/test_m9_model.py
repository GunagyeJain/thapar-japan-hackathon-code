"""m9 model path: Gemini is replaced by a stand-in, the cache by a temp folder. No network, no key needed."""
import time
from pathlib import Path

import pytest

from app.modules.m9_recipes import cache, gemini, pipeline

SHEETS = Path(__file__).resolve().parents[2] / "shared" / "seed" / "recipes"
MISO = (SHEETS / "miso_soup.txt").read_text(encoding="utf-8")

MISO_MODEL = {
    "dish_name_ja": "味噌汁",
    "dish_name_en": "Miso soup",
    "transcription": MISO,
    "ingredients": [
        {"name_ja": "出汁", "name_en": "dashi (bonito and kombu stock)", "tags": ["bonito", "kombu"], "confidence": 0.95, "evidence": "出汁 600ml（鰹節 15g、昆布 5g）"},
        {"name_ja": "わかめ", "name_en": "wakame seaweed", "tags": ["seaweed"], "confidence": 0.9, "evidence": "わかめ（乾燥）4g"},
        {"name_ja": "豆腐", "name_en": "tofu", "tags": ["soy"], "confidence": 0.95, "evidence": "豆腐 1/2丁"},
    ],
}


@pytest.fixture(autouse=True)
def isolated(monkeypatch, tmp_path):
    monkeypatch.setattr(cache, "CACHE_DIR", tmp_path / "cache")
    calls = []

    def fake_extract(*, text=None, image=None, mime_type="image/png"):
        calls.append("image" if image else "text")
        return MISO_MODEL

    monkeypatch.setattr(gemini, "extract", fake_extract)
    return calls


def verdict(result, diet):
    return next(v for v in result["verdicts"] if v["diet"] == diet)


def test_model_answer_is_cached_and_reused(isolated):
    first = pipeline.run(MISO.encode())
    assert first["cached"] is False and first["engine"] == "dictionary+gemini"
    start = time.perf_counter()
    second = pipeline.run(MISO.encode())
    assert second["cached"] is True
    assert time.perf_counter() - start < 1.0  # the call count below proves the reuse; this only catches a re-run
    assert isolated == ["text"]


def test_model_fills_what_the_dictionary_missed():
    result = pipeline.run(MISO.encode())
    wakame = next(r for r in result["ingredients"] if r["name_ja"] == "わかめ")
    assert wakame["tags"] == ["seaweed"] and wakame["name_en"] == "wakame seaweed"
    # The dictionary's chain still shows, and nothing the dictionary saw is dropped.
    assert any(f["via"].startswith("出汁 → bonito → fish") for f in verdict(result, "vegetarian")["fired"])
    assert "長ねぎ" in [r["name_ja"] for r in result["ingredients"]]
    # wakame is known now, so the only problem for a vegetarian is the fish.
    assert all(f["effect"] == "UNSAFE" for f in verdict(result, "vegetarian")["fired"])


def test_photo_uses_the_transcription(isolated):
    result = pipeline.run(b"\x89PNG fake", is_image=True)
    assert isolated == ["image"]
    assert result["text"] == MISO and result["engine"] == "dictionary+gemini"
    assert verdict(result, "jain")["verdict"] == "UNSAFE"


def test_unknown_model_tag_needs_a_person(monkeypatch):
    model = {**MISO_MODEL, "ingredients": [{"name_ja": "謎のソース", "name_en": "house sauce", "tags": ["house_sauce"], "confidence": 0.4, "evidence": "謎のソース"}]}
    monkeypatch.setattr(gemini, "extract", lambda **_: model)
    result = pipeline.run("材料\n・謎のソース 少々\n".encode())
    assert verdict(result, "vegan")["verdict"] == "NEEDS_HUMAN"


def test_offline_falls_back_to_dictionary(monkeypatch):
    def offline(**_):
        raise gemini.ModelUnavailable("No GEMINI_API_KEY in .env")

    monkeypatch.setattr(gemini, "extract", offline)
    result = pipeline.run(MISO.encode())
    assert result["engine"] == "dictionary" and result["model_note"].startswith("Model offline")
    assert verdict(result, "vegetarian")["verdict"] == "UNSAFE"
    assert not list(cache.CACHE_DIR.glob("*.json")) if cache.CACHE_DIR.exists() else True
    with pytest.raises(pipeline.PhotoNeedsModel):
        pipeline.run(b"\x89PNG fake", is_image=True)


def test_photo_upload_over_http(client):
    res = client.post("/api/recipes/extract", files={"file": ("miso.png", b"\x89PNG fake", "image/png")})
    assert res.status_code == 200, res.text
    assert res.json()["name"]["ja"] == "味噌汁"
    assert client.post("/api/recipes/extract", files={"file": ("a.txt", b"hi", "text/plain")}).status_code == 415


def test_photo_without_transcription_still_gets_the_dictionary(monkeypatch):
    model = {**MISO_MODEL, "transcription": ""}
    monkeypatch.setattr(gemini, "extract", lambda **_: model)
    result = pipeline.run(b"\x89PNG other", is_image=True)
    assert result["engine"] == "dictionary+gemini"
    assert "出汁 600ml" in result["text"]
    assert any(f["via"].startswith("出汁 → bonito → fish") for f in verdict(result, "vegetarian")["fired"])
