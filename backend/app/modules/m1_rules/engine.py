"""Rules engine: diets are ingredient rules, and every verdict names the rule that fired.

Pure functions over the JSON in shared/rules/. frontend/src/lib/rules/ is a line-by-line
port of this file; shared/rules/vectors.json keeps the two in step, so change both together.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

RULES_DIR = Path(__file__).resolve().parents[4] / "shared" / "rules"

SAFE, UNSAFE, NEEDS_HUMAN = "SAFE", "UNSAFE", "NEEDS_HUMAN"
NON_HALAL = "non_halal_meat"
HALAL_CERTIFIED = "halal_certified"
MEAT = "meat"


class UnknownTagError(ValueError):
    """A forbid/allow list or a preset id that the rules data doesn't know."""


def _load(name: str) -> dict:
    return json.loads((RULES_DIR / f"{name}.json").read_text(encoding="utf-8"))


def _dedupe(items) -> list:
    return list(dict.fromkeys(items))


@dataclass(frozen=True)
class Rules:
    version: str
    tags: dict
    synonyms: dict
    diets: dict
    presets: dict
    picker_groups: list
    codes: dict
    note_phrases: dict
    preference_groups: list
    label_bases: list

    def paths(self, tag: str) -> dict:
        """Every ancestor of `tag` (itself included) -> shortest path [tag, ..., ancestor]."""
        return _paths(self, tag)

    def label(self, tag: str, lang: str) -> str:
        labels = self.tags[tag]["labels"]
        return labels.get(lang) or labels["en"]


@lru_cache(maxsize=1)
def rules() -> Rules:
    taxonomy, diets, presets, codes = (_load(n) for n in ("taxonomy", "diets", "presets", "codes"))
    tags = {t["id"]: t for t in taxonomy["tags"]}
    synonyms: dict = {}
    for t in taxonomy["tags"]:
        for word in t["synonyms_ja"]:
            synonyms.setdefault(word, t["id"])
        for word in t["synonyms_en"]:
            synonyms.setdefault(word.lower(), t["id"])
    return Rules(
        version=taxonomy["version"],
        tags=tags,
        synonyms=synonyms,
        diets={d["id"]: d for d in diets["diets"]},
        presets={p["id"]: p for p in presets["presets"]},
        picker_groups=presets["picker_groups"],
        codes={c["code"]: c for c in codes["codes"]},
        note_phrases=codes["note_phrases"],
        preference_groups=codes["preference_groups"],
        label_bases=codes["label_bases"],
    )


_PATHS_CACHE: dict = {}


def _paths(r: Rules, tag: str) -> dict:
    if tag in _PATHS_CACHE:
        return _PATHS_CACHE[tag]
    found = {tag: [tag]}
    queue = [tag]
    while queue:
        node = queue.pop(0)
        t = r.tags[node]
        for nxt in ([t["parent"]] if t["parent"] else []) + t.get("also", []):
            if nxt not in found:
                found[nxt] = found[node] + [nxt]
                queue.append(nxt)
    _PATHS_CACHE[tag] = found
    return found


def _covers(r: Rules, general: str, specific: str) -> bool:
    """True when `general` is `specific` or one of its ancestors."""
    return general in r.paths(specific)


def check_tags(tags) -> list:
    """Dedupe a forbid/allow list and reject ids that aren't in the taxonomy."""
    r = rules()
    tags = _dedupe(tags or [])
    unknown = [t for t in tags if t not in r.tags]
    if unknown:
        raise UnknownTagError(f"Unknown tags: {', '.join(unknown)}")
    return tags


def resolve(raw: str):
    """A dish tag, or a Japanese/English ingredient word -> (tag id | None, matched by synonym)."""
    r = rules()
    word = raw.strip()
    if word in r.tags:
        return word, False
    tag = r.synonyms.get(word) or r.synonyms.get(word.lower())
    return tag, tag is not None


def _minimal(r: Rules, forbid: list) -> list:
    """Drop forbid tags already covered by a more general forbid tag."""
    return [f for f in forbid if not any(g != f and _covers(r, g, f) for g in forbid)]


def _lower(r: Rules, tag: str) -> str:
    return r.label(tag, "en").lower()


# ---------------------------------------------------------------- evaluate


def _fired(rule_id, tag, via, effect, message, diet):
    fired = {"rule_id": rule_id, "tag": tag, "via": via, "effect": effect, "message": message}
    if diet:
        fired["diet"] = diet
    return fired


def _msg_contains(r: Rules, item: str, hit: str) -> dict:
    if item == hit:
        return {
            "en": f"Contains {_lower(r, hit)}",
            "ja": f"{r.label(hit, 'ja')}を含む",
            "hi": f"इसमें {r.label(hit, 'hi')} है",
        }
    return {
        "en": f"Contains {_lower(r, item)} ({_lower(r, hit)})",
        "ja": f"{r.label(item, 'ja')}（{r.label(hit, 'ja')}）を含む",
        "hi": f"इसमें {r.label(item, 'hi')} ({r.label(hit, 'hi')}) है",
    }


def _msg_unclear(r: Rules, item: str, maybe: str) -> dict:
    return {
        "en": f"Says only {_lower(r, item)}; it could be {_lower(r, maybe)}. Check with the kitchen",
        "ja": f"「{r.label(item, 'ja')}」としか分かりません。{r.label(maybe, 'ja')}の可能性があります。キッチンに確認してください",
        "hi": f"सिर्फ़ '{r.label(item, 'hi')}' लिखा है; यह {r.label(maybe, 'hi')} हो सकता है। रसोई से पूछें",
    }


MSG_HALAL = {
    "en": "Meat without halal certification. Check with the kitchen",
    "ja": "ハラール認証のない肉です。キッチンに確認してください",
    "hi": "बिना हलाल प्रमाणन का मांस। रसोई से पूछें",
}


def _msg_unknown(raw: str) -> dict:
    return {
        "en": f'Unknown ingredient "{raw}". A person must check it',
        "ja": f"不明な原材料「{raw}」。担当者の確認が必要です",
        "hi": f'अज्ञात सामग्री "{raw}"। किसी व्यक्ति को जाँचना होगा',
    }


def evaluate(forbid, tags, diet: str | None = None) -> dict:
    """Check a dish's tags against a person's forbid list.

    One fired rule per dish tag, the closest forbidden family first. Precedence of the
    verdict: UNSAFE > NEEDS_HUMAN > SAFE. Unknown words, vague tags ("meat" when beef is
    forbidden) and meat without halal certification need a person.
    """
    r = rules()
    forbid = check_tags(forbid)
    forbidden = set(forbid)
    items = [(raw, *resolve(raw)) for raw in _dedupe(tags or [])]
    certified = any(tag == HALAL_CERTIFIED for _, tag, _ in items)
    fired = []
    for raw, tag, by_synonym in items:
        if tag is None:
            fired.append(_fired("unknown_tag", raw, raw, NEEDS_HUMAN, _msg_unknown(raw), diet))
            continue
        if r.tags[tag].get("kind") == "property":
            continue
        paths = r.paths(tag)
        head = [raw] if by_synonym else []
        hit = next((a for a in paths if a in forbidden), None)
        if hit:
            via = " → ".join(head + paths[hit])
            fired.append(_fired(f"forbid.{hit}", hit, via, UNSAFE, _msg_contains(r, tag, hit), diet))
            continue
        vague = next((f for f in forbid if f != NON_HALAL and f != tag and _covers(r, tag, f)), None)
        if vague:
            via = " → ".join(head + [tag])
            fired.append(_fired(f"unclear.{vague}", vague, via, NEEDS_HUMAN, _msg_unclear(r, tag, vague), diet))
            continue
        if NON_HALAL in forbidden and not certified and MEAT in paths:
            via = " → ".join(head + paths[MEAT])
            fired.append(_fired("halal.certification", NON_HALAL, via, NEEDS_HUMAN, MSG_HALAL, diet))
    effects = {f["effect"] for f in fired}
    verdict = UNSAFE if UNSAFE in effects else NEEDS_HUMAN if NEEDS_HUMAN in effects else SAFE
    return {"verdict": verdict, "fired": fired}


def spec_tags(tags, certified: bool = False) -> list:
    """A MealSpec's tags for evaluate(): `certified` counts as the halal certificate."""
    tags = list(tags or [])
    return tags + [HALAL_CERTIFIED] if certified and HALAL_CERTIFIED not in tags else tags


def evaluate_diet(diet_id: str, tags) -> dict:
    """evaluate() with a named diet's forbid list; every fired rule carries the diet id."""
    diet = rules().diets.get(diet_id)
    if diet is None:
        raise UnknownTagError(f"Unknown diet: {diet_id}")
    return evaluate(diet["forbid"], tags, diet=diet_id)


def combine_presets(preset_ids) -> dict:
    """Presets tapped together -> {forbid, allow}. Allow keeps only what nothing forbids."""
    r = rules()
    unknown = [p for p in preset_ids if p not in r.presets]
    if unknown:
        raise UnknownTagError(f"Unknown presets: {', '.join(unknown)}")
    picked = [r.presets[p] for p in _dedupe(preset_ids)]
    forbid = _dedupe(t for p in picked for t in p["forbid"])
    allow = _dedupe(t for p in picked for t in p["allow"])
    allow = [a for a in allow if not any(_covers(r, f, a) for f in forbid)]
    return {"forbid": forbid, "allow": allow}


# ---------------------------------------------------------------- meal codes


def _analyze(r: Rules, code: dict, forbid_min: list) -> dict:
    """Split a person's forbid list against one meal code."""
    gaps, contains, blocked = [], [], []
    for f in forbid_min:
        if any(_covers(r, e, f) for e in code["excludes"]):
            continue
        hits = [c for c in code["contains"] if _covers(r, f, c)]
        if hits:
            contains += [c for c in hits if c not in contains]
        elif f in r.note_phrases:
            gaps.append(f)
        else:
            blocked.append(f)
    return {"gaps": gaps, "contains": contains, "blocked": blocked}


def _losses(r: Rules, code: dict, forbid: list, allow: list) -> list:
    """Food families the person eats that this code leaves out."""

    def removed(tag):
        return any(_covers(r, e, tag) for e in code["excludes"])

    losses = []
    for group in r.preference_groups:
        touched = any(_covers(r, f, group) or _covers(r, group, f) for f in forbid)
        if removed(group) and not touched:
            losses.append(group)
    for a in allow:
        already = any(_covers(r, lost, a) for lost in losses)
        if removed(a) and not already and not any(_covers(r, f, a) for f in forbid):
            losses.append(a)
    return losses


def _note(r: Rules, gaps: list):
    return " ".join(r.note_phrases[g] for g in gaps) or None


def _why(r: Rules, note, losses: list) -> dict:
    if note is None:
        why = {"en": "Safe as it is.", "ja": "そのままで安全。", "hi": "जैसा है वैसा सुरक्षित।"}
    else:
        why = {
            "en": f'Safe with the kitchen note "{note}".',
            "ja": f"キッチンへの指示「{note}」で安全。",
            "hi": f'रसोई नोट "{note}" के साथ सुरक्षित।',
        }
    if losses:
        why = {
            "en": why["en"] + f" Leaves out {', '.join(_lower(r, t) for t in losses)}, which this passenger eats.",
            "ja": why["ja"] + f"{'、'.join(r.label(t, 'ja') for t in losses)}は含まれません。",
            "hi": why["hi"] + f" इसमें {', '.join(r.label(t, 'hi') for t in losses)} नहीं होंगे, जो यह यात्री खाते हैं।",
        }
    return why


def _dominated(option: dict, others: list) -> bool:
    gaps, losses = len(option["safety_gaps"]), len(option["preference_losses"])
    for o in others:
        og, ol = len(o["safety_gaps"]), len(o["preference_losses"])
        if og <= gaps and ol <= losses and (og < gaps or ol < losses):
            return True
    return False


def code_options(forbid, allow=None) -> list:
    """Meal codes that are safe for this person (with a kitchen note if needed), best first.

    Codes with a gap no kitchen note can close are left out. The rest are sorted by
    preference losses, then safety gaps; options another option beats on both counts
    move to the end.
    """
    r = rules()
    forbid, allow = check_tags(forbid), check_tags(allow)
    if not forbid:
        return []
    forbid_min = _minimal(r, forbid)
    mark = label_mark(forbid, allow)
    options = []
    for code in r.codes.values():
        a = _analyze(r, code, forbid_min)
        if a["contains"] or a["blocked"]:
            continue
        losses = _losses(r, code, forbid, allow)
        note = _note(r, a["gaps"])
        options.append(
            {
                "code": code["code"],
                "recommended": False,
                "safety_gaps": a["gaps"],
                "preference_losses": losses,
                "kitchen_note": note,
                "label_mark": mark,
                "why": _why(r, note, losses),
            }
        )
    options.sort(key=lambda o: (len(o["preference_losses"]), len(o["safety_gaps"])))
    best = [o for o in options if not _dominated(o, options)]
    rest = [o for o in options if _dominated(o, options)]
    ranked = [{**o, "recommended": i == 0} for i, o in enumerate(best + rest)]
    return ranked


def check_booking(forbid, booked_code) -> dict:
    """Is the booked SSR code safe for this person? If not, what it contains and what to book."""
    r = rules()
    forbid = check_tags(forbid)
    if not forbid:
        return {"ok": True, "kitchen_note": None}
    options = code_options(forbid)
    suggested = options[0]["code"] if options else None
    code = r.codes.get((booked_code or "").strip().upper())
    if code is None:
        message = (
            {"en": f"Unknown meal code {booked_code}.", "ja": f"不明なミールコード {booked_code}。", "hi": f"अज्ञात भोजन कोड {booked_code}।"}
            if booked_code
            else {"en": "No special meal is booked.", "ja": "特別食が予約されていません。", "hi": "कोई विशेष भोजन बुक नहीं है।"}
        )
        return {"ok": False, "problem": {"contains": [], "message": message}, "suggested_code": suggested}
    a = _analyze(r, code, _minimal(r, forbid))
    bad = a["contains"] + a["blocked"]
    if not bad:
        return {"ok": True, "kitchen_note": _note(r, a["gaps"])}
    name = code["code"]
    verb_en, verb_ja = ("contains", "を含みます") if a["contains"] else ("can include", "が入ることがあります")
    message = {
        "en": f"{name} {verb_en} {', '.join(_lower(r, t) for t in bad)}, which this passenger does not eat.",
        "ja": f"{name}は{'、'.join(r.label(t, 'ja') for t in bad)}{verb_ja}。この方は食べられません。",
        "hi": f"{name} में {', '.join(r.label(t, 'hi') for t in bad)} है, जो यह यात्री नहीं खाते।",
    }
    result = {"ok": False, "problem": {"contains": bad, "message": message}}
    if suggested and suggested != name:
        result["suggested_code"] = suggested
    return result


def label_mark(forbid, allow=None) -> dict:
    """Short tray-label mark, e.g. "VEG · no onion, no garlic". `allow` doesn't change the mark."""
    r = rules()
    forbid = check_tags(forbid)
    check_tags(allow)
    if not forbid:
        return {"en": "No food rules", "ja": "制限なし", "hi": "कोई नियम नहीं"}
    base = next(
        (b for b in r.label_bases if all(any(_covers(r, f, req) for f in forbid) for req in b["requires"])),
        None,
    )
    known = (base["requires"] + base["implies"]) if base else []
    rest = [f for f in _minimal(r, forbid) if not any(_covers(r, k, f) for k in known)]
    parts = {
        "en": ", ".join(f"no {_lower(r, t)}" for t in rest),
        "ja": "、".join(f"{r.label(t, 'ja')}なし" for t in rest),
        "hi": ", ".join(f"{r.label(t, 'hi')} नहीं" for t in rest),
    }
    if not base:
        return parts
    return {lang: base["labels"][lang] + (f" · {parts[lang]}" if rest else "") for lang in ("en", "ja", "hi")}


@lru_cache(maxsize=1)
def rules_payload() -> dict:
    """Everything GET /api/rules returns."""
    taxonomy, diets, presets, codes = (_load(n) for n in ("taxonomy", "diets", "presets", "codes"))
    return {
        "version": taxonomy["version"],
        "taxonomy": taxonomy["tags"],
        "diets": diets["diets"],
        "presets": presets["presets"],
        "codes": codes["codes"],
        "picker_groups": presets["picker_groups"],
        "note_phrases": codes["note_phrases"],
    }
