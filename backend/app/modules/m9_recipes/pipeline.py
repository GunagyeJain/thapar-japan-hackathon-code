"""Recipe sheet → ingredients → per-diet verdicts. The rules decide; a model (when there is one) only reads."""
import hashlib

from app.modules.m1_rules import engine

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
        known = [t for t in row.get("tags", []) if t in engine.rules().tags]
        if row.get("words"):
            words += row["words"]
            # Tags the model added beyond the dictionary hits.
            covered = {engine.resolve(w)[0] for w in row["words"]}
            words += [t for t in known if t not in covered]
        elif known:
            words += known
        else:
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
