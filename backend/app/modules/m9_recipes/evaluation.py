"""How well each reader finds what an Indian vegetarian can't eat: dictionary, model, and both together.

The test set is shared/seed/recipes/eval.json (hand-labelled). The model column uses only the
committed cache, so the table never calls Gemini; fill the cache once with

    cd backend && .venv/bin/python -m app.modules.m9_recipes.evaluation --fill
"""
import json
import sys
import time
from pathlib import Path

from app.modules.m1_rules import engine

from . import cache, gemini, pipeline
from .dictionary import read_sheet

SHEETS = Path(__file__).resolve().parents[4] / "shared" / "seed" / "recipes"
EVAL_FILE = SHEETS / "eval.json"
# Free tier: 5 requests a minute.
FILL_SPACING_S = 13


def load() -> dict:
    return json.loads(EVAL_FILE.read_text(encoding="utf-8"))


def sheet_text(dish: dict) -> str:
    return (SHEETS / dish["file"]).read_text(encoding="utf-8") if "file" in dish else dish["text"]


def flags(rows: list[dict], diet: str) -> list[str]:
    """The families the rules call UNSAFE for this diet (meat, seafood, egg, gelatin for vegetarian).
    NEEDS_HUMAN is not a flag: it sends the line to a person, it doesn't say what's in it."""
    result = engine.evaluate_diet(diet, pipeline.rule_words(rows))
    return list(dict.fromkeys(f["tag"] for f in result["fired"] if f["effect"] == engine.UNSAFE))


def readers(text: str) -> dict[str, list[dict] | None]:
    """Ingredient rows from each reader. `model` is None when the cache has no answer for this sheet."""
    dictionary = read_sheet(text)["ingredients"]
    model = cache.get(pipeline.source_hash(text.encode("utf-8")))
    if model is None:
        return {"dictionary": dictionary, "model": None, "combined": None}
    return {
        "dictionary": dictionary,
        "model": model["ingredients"],
        "combined": pipeline.merge(dictionary, model["ingredients"]),
    }


def _metrics(rows: list[dict], key: str) -> dict | None:
    scored = [r for r in rows if r[key] is not None]
    if not scored:
        return None
    hits = sum(len(set(r[key]) & set(r["truth"])) for r in scored)
    misses = sum(len(set(r["truth"]) - set(r[key])) for r in scored)
    false_alarms = sum(len(set(r[key]) - set(r["truth"])) for r in scored)
    unsafe = [r for r in scored if r["truth"]]
    safe = [r for r in scored if not r["truth"]]
    return {
        "dishes": len(scored),
        "hits": hits,
        "misses": misses,
        "false_alarms": false_alarms,
        "recall": round(hits / (hits + misses), 3) if hits + misses else None,
        "precision": round(hits / (hits + false_alarms), 3) if hits + false_alarms else None,
        # Per dish: a non-vegetarian dish counts as caught when anything in it is flagged.
        "unsafe_dishes": len(unsafe),
        "unsafe_dishes_caught": sum(1 for r in unsafe if r[key]),
        "safe_dishes": len(safe),
        "safe_dishes_flagged": sum(1 for r in safe if r[key]),
    }


def table() -> dict:
    data = load()
    diet = data["diet"]
    rows = []
    for dish in data["dishes"]:
        read = readers(sheet_text(dish))
        rows.append({
            "id": dish["id"],
            "dish": dish["name"],
            "truth": dish["truth"],
            **{k: (flags(v, diet) if v is not None else None) for k, v in read.items()},
        })
    # The three readers are compared on the same dishes: the ones the model has read.
    compared = [r for r in rows if r["model"] is not None]
    return {
        "diet": diet,
        "rows": rows,
        "compared": len(compared),
        "metrics": {k: _metrics(compared, k) for k in ("dictionary", "model", "combined")},
    }


def fill_cache() -> None:
    """Ask Gemini once for every eval sheet the cache doesn't have yet."""
    todo = [d for d in load()["dishes"] if readers(sheet_text(d))["model"] is None]
    print(f"{len(todo)} sheet(s) to read with {gemini.model_name()}")
    for i, dish in enumerate(todo):
        if i:
            time.sleep(FILL_SPACING_S)
        text = sheet_text(dish)
        try:
            answer = gemini.extract(text=text)
        except gemini.ModelUnavailable as exc:
            print(f"  {dish['id']}: {exc}")
            continue
        cache.put(pipeline.source_hash(text.encode("utf-8")), answer, model=gemini.model_name(), source="text")
        print(f"  {dish['id']}: cached")


if __name__ == "__main__":
    if "--fill" in sys.argv:
        from dotenv import load_dotenv

        load_dotenv(Path(__file__).resolve().parents[4] / ".env")
        fill_cache()
    print(json.dumps(table()["metrics"], indent=1))
