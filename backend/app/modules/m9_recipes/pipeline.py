"""Recipe sheet → ingredients → per-diet verdicts. The rules decide; a model (when there is one) only reads."""
import hashlib
import re

from app.modules.m1_rules import engine

from . import cache, gemini
from .dictionary import NEUTRAL, read_sheet

# Diets the caterer sees a verdict for (m9 spec).
DIETS = ("vegetarian", "jain", "vegan", "no_onion_garlic", "halal")


def source_hash(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _words_of(row: dict) -> list[str]:
    """Japanese words that name a row's tags: the dictionary hits, or the name itself when the
    model's name is a dictionary word (ラード)."""
    words = list(row.get("words", []))
    tag = engine.resolve(row["name_ja"])[0]
    if not words and tag and tag in row.get("tags", []):
        words = [row["name_ja"]]
    return words


def rule_words(ingredients: list[dict]) -> list[str]:
    """What the rules engine reads: every Japanese word first (so the chain shows
    "出汁 → bonito → fish"), then tags no word already covers, then bare names nobody could
    read (the engine marks those NEEDS_HUMAN, so a person checks them)."""
    rows = [r for r in ingredients if not (r["name_ja"] in NEUTRAL and not r.get("words"))]
    words: list[str] = [w for r in rows for w in _words_of(r)]
    covered = {engine.resolve(w)[0] for w in words}
    known = engine.rules().tags

    def is_covered(tag: str) -> bool:
        # bonito covers fish and seafood: they add nothing once bonito is in.
        return tag in covered or (tag in known and any(c and tag in engine.rules().paths(c) for c in covered))

    tags = [t for r in rows for t in r.get("tags", []) if not is_covered(t)]
    unread = [r["name_ja"] for r in rows if not r.get("tags") and not _words_of(r)]
    return list(dict.fromkeys(words + tags + unread))


def verdicts(ingredients: list[dict]) -> list[dict]:
    words = rule_words(ingredients)
    out = []
    for diet in DIETS:
        result = engine.evaluate_diet(diet, words)
        # Dictionary words come first, so the first rule per family carries the fullest chain
        # ("出汁 → bonito → fish → seafood"); later copies from the model's tags add nothing.
        seen: set[tuple[str, str]] = set()
        fired = []
        for f in result["fired"]:
            if (f["rule_id"], f["tag"]) not in seen:
                seen.add((f["rule_id"], f["tag"]))
                fired.append(f)
        out.append({"diet": diet, "verdict": result["verdict"], "fired": fired})
    return out


def _base(name: str) -> str:
    """わかめ（乾燥） → わかめ"""
    return re.split(r"[（(]", name, maxsplit=1)[0].strip()


def merge(dictionary_rows: list[dict], model_rows: list[dict]) -> list[dict]:
    """Model rows first (they name every ingredient); dictionary hits are added to the row with
    the same name, or kept as their own row, so nothing the dictionary saw is ever dropped."""
    rows = [{**r, "words": list(r.get("words", []))} for r in model_rows]
    by_name = {_base(r["name_ja"]): r for r in rows}
    for d in dictionary_rows:
        target = by_name.get(_base(d["name_ja"]))
        if target is None and not d["tags"]:
            # A line the dictionary couldn't read: keep it only if the model didn't name it either.
            target = next((r for r in rows if _base(d["name_ja"]) in r["name_ja"] or _base(r["name_ja"]) in d["name_ja"]), None)
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


def _photo_text(model: dict | None) -> str:
    """The model's transcription of a photo. If it left that out, rebuild an ingredient list
    from its evidence lines, so the dictionary still gets a second look."""
    if not model:
        return ""
    if model.get("transcription", "").strip():
        return model["transcription"]
    lines = [f"・{row.get('evidence') or row['name_ja']}" for row in model.get("ingredients", [])]
    return "\n".join([model.get("dish_name_ja", ""), "", "材料", *lines]).strip()


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
    text = _photo_text(model) if is_image else data.decode("utf-8")

    read = read_sheet(text)
    rows = merge(read["ingredients"], model["ingredients"]) if model else read["ingredients"]
    # Water and ice carry no food rule; the dictionary skips them, so skip the model's too.
    rows = [r for r in rows if not (r["name_ja"] in NEUTRAL and not r.get("tags"))]
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
