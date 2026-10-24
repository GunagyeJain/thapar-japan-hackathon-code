"""Recipe sheet → ingredients → per-diet verdicts. The rules decide; a model (when there is one) only reads."""
import hashlib

from app.modules.m1_rules import engine

from . import cache, gemini
from .dictionary import read_sheet

# Diets the caterer sees a verdict for (m9 spec).
DIETS = ("vegetarian", "jain", "vegan", "no_onion_garlic", "halal")


def source_hash(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def rule_words(ingredients: list[dict]) -> list[str]:
    """What the rules engine reads for each row: the dictionary word (so the chain shows
    "出汁 → bonito → fish"), else the tags, else the bare name (unknown → a person checks)."""
    words: list[str] = []
    for row in ingredients:
        tags = row.get("tags", [])
        covered = {engine.resolve(w)[0] for w in row.get("words", [])}
        words += row.get("words", [])
        # Tags the model added beyond the dictionary hits. A tag the taxonomy doesn't know
        # goes in as it is, so the engine marks it NEEDS_HUMAN.
        words += [t for t in tags if t not in covered]
        if not row.get("words") and not tags:
            words.append(row["name_ja"])
    return list(dict.fromkeys(words))


def verdicts(ingredients: list[dict]) -> list[dict]:
    words = rule_words(ingredients)
    out = []
    for diet in DIETS:
        result = engine.evaluate_diet(diet, words)
        out.append({"diet": diet, "verdict": result["verdict"], "fired": result["fired"]})
    return out


def merge(dictionary_rows: list[dict], model_rows: list[dict]) -> list[dict]:
    """Model rows first (they name every ingredient); dictionary hits are added to the row with
    the same name, or kept as their own row, so nothing the dictionary saw is ever dropped."""
    rows = [{**r, "words": list(r.get("words", []))} for r in model_rows]
    by_name = {r["name_ja"]: r for r in rows}
    for d in dictionary_rows:
        target = by_name.get(d["name_ja"])
        if target is None:
            rows.append(d)
            by_name[d["name_ja"]] = d
            continue
        target["tags"] = list(dict.fromkeys([*target.get("tags", []), *d["tags"]]))
        target["words"] = list(dict.fromkeys([*target["words"], *d["words"]]))
        target["confidence"] = max(target.get("confidence", 0.0), d["confidence"])
    return rows


def dictionary_only(text: str) -> dict:
    sheet = read_sheet(text)
    return {**sheet, "verdicts": verdicts(sheet["ingredients"])}


class PhotoNeedsModel(Exception):
    pass


def run(data: bytes, *, is_image: bool = False, mime_type: str = "image/png") -> dict:
    """The whole pipeline for one sheet: cache → Gemini → dictionary → merge → verdicts."""
    h = source_hash(data)
    model = cache.get(h)
    cached = model is not None
    note = None
    if model is None:
        try:
            model = gemini.extract(
                text=None if is_image else data.decode("utf-8"),
                image=data if is_image else None,
                mime_type=mime_type,
            )
        except gemini.ModelUnavailable as exc:
            note = f"Model offline: dictionary only. {exc}"
        else:
            cache.put(h, model, model=gemini.model_name(), source="image" if is_image else "text")

    if is_image and model is None:
        raise PhotoNeedsModel(note or "Reading a photo needs the model")
    text = (model or {}).get("transcription", "") if is_image else data.decode("utf-8")

    read = read_sheet(text)
    rows = merge(read["ingredients"], model["ingredients"]) if model else read["ingredients"]
    if model and read["ingredients"]:
        engine_name = "dictionary+gemini"
    else:
        engine_name = "gemini" if model else "dictionary"
    return {
        "source_hash": h,
        "cached": cached,
        "engine": engine_name,
        "dish_name_ja": read["dish_name_ja"] or (model or {}).get("dish_name_ja", ""),
        "dish_name_en": read["dish_name_en"] or (model or {}).get("dish_name_en", ""),
        "ingredients": rows,
        "verdicts": verdicts(rows),
        "text": text,
        "model_note": note,
    }
