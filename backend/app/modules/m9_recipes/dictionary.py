"""Dictionary pass: find every Japanese ingredient word m1's taxonomy knows in a recipe sheet.

Works with no model at all. Longest match wins, so 玉ねぎ is onion (not ねぎ, leek) and
昆布だし is kombu (not だし, bonito).
"""
import re
from functools import lru_cache

from app.modules.m1_rules import engine

# Words that contain an ingredient word but aren't one. They are matched and dropped.
NOT_INGREDIENTS = ("ただし", "出だし")
# Ingredient lines that carry no food rule. Anything else the dictionary can't read goes to a person.
NEUTRAL = {"水", "湯", "お湯", "冷水", "氷", "熱湯"}

_SECTION_INGREDIENTS = re.compile(r"^(材料|食材)")
_SECTION_STEPS = re.compile(r"^(作り方|手順|調理)")
_NAME_END = re.compile(r"[\s　（(:：]")


@lru_cache(maxsize=1)
def _words() -> list[tuple[str, str | None]]:
    """(word, tag id or None), longest first."""
    pairs: dict[str, str | None] = {w: None for w in NOT_INGREDIENTS}
    for tag in engine.rules().tags.values():
        for word in tag["synonyms_ja"]:
            pairs.setdefault(word, tag["id"])
    return sorted(pairs.items(), key=lambda p: -len(p[0]))


def scan(text: str) -> list[tuple[str, str]]:
    """Every (word, tag id) in reading order, without overlaps."""
    found: list[tuple[str, str]] = []
    i = 0
    while i < len(text):
        for word, tag in _words():
            if text.startswith(word, i):
                if tag:
                    found.append((word, tag))
                i += len(word)
                break
        else:
            i += 1
    return found


def _field(text: str, label: str) -> str | None:
    m = re.search(rf"^{label}[：:]\s*(.+)$", text, re.MULTILINE)
    return m.group(1).strip() if m else None


def _ingredient_name(line: str) -> str:
    body = line.lstrip("・-*•　 ").strip()
    return _NAME_END.split(body, maxsplit=1)[0] or body


def _uniq(items):
    return list(dict.fromkeys(items))


def read_sheet(text: str) -> dict:
    """Parse a recipe sheet into a dish name and ingredient rows (the RecipeSheet schema).

    Each row is {name_ja, name_en, tags, confidence, evidence, words}. `words` are the exact
    dictionary hits, so the rules engine can show "出汁 → bonito → fish".
    """
    rows: list[dict] = []
    seen_tags: set[str] = set()
    section = None
    for raw in text.splitlines():
        line = raw.strip()
        if not line:
            continue
        if _SECTION_INGREDIENTS.match(line):
            section = "ingredients"
            continue
        if _SECTION_STEPS.match(line):
            section = "steps"
            continue
        hits = scan(line)
        if section == "ingredients" and line[0] in "・-*•":
            name = _ingredient_name(line)
            if not hits and name in NEUTRAL:
                continue
            rows.append(_row(name, hits, line))
            seen_tags.update(tag for _, tag in hits)
        elif section == "steps":
            # A step can name something the list left out ("鰹節を加えて").
            for word, tag in hits:
                if tag not in seen_tags:
                    rows.append(_row(word, [(word, tag)], line))
                    seen_tags.add(tag)
    return {
        "dish_name_ja": _field(text, "料理名") or "",
        "dish_name_en": _field(text, "英語名") or "",
        "ingredients": rows,
    }


def _row(name: str, hits: list[tuple[str, str]], line: str) -> dict:
    r = engine.rules()
    tags = _uniq(tag for _, tag in hits)
    name_tag = next((tag for word, tag in hits if word == name), None)
    return {
        "name_ja": name,
        "name_en": r.label(name_tag, "en") if name_tag else "",
        "tags": tags,
        "confidence": 1.0 if hits else 0.0,
        "evidence": "、".join(_uniq(word for word, _ in hits)) if hits else line.lstrip("・-*•　 "),
        "words": _uniq(word for word, _ in hits),
    }
