"""POST /api/passport/understand: the dictionary reading (plus the extraction model when it is set up) → Rules + chips.

Presets give the base rules; what the person says about single foods refines them ("veg, but egg chalega" releases egg).
An explicit "no" always wins over an "OK". Allergies are always hard; a diabetic's sugar rules are firm (medical);
"prefer not" makes a forbid soft. Stores nothing.
"""
from dataclasses import dataclass
from typing import Any

from app.modules.m1_rules import engine
from app.modules.m17_passport import model, words
from app.modules.m17_passport.service import TIER_ORDER, tier_for

DIABETIC = "diabetic"
TIME_RULE_KEYS = ("id", "kind", "dates", "weekdays", "preset", "add_forbid", "after_sunrise_min", "confirm", "confirmed", "declined")


@dataclass(frozen=True)
class Src:
    via: str
    tier: str | None  # a forced tier, or None: the taxonomy decides (service.tier_for)
    source: str = "dictionary"  # dictionary | model


def _label(tag: str) -> str:
    return engine.rules().label(tag, "en").lower()


def _via(word: str, target: str) -> str:
    """"lahsun → garlic"; just "garlic" when the person wrote "garlic"."""
    return word if words.normalize(word) == words.normalize(target) else f"{word} → {target}"


def _covers(general: str, specific: str) -> bool:
    return general in engine.rules().paths(specific)


def _children(tag: str) -> list[str]:
    return [t for t, v in engine.rules().tags.items() if v["parent"] == tag and v.get("kind") not in ("rule", "property")]


def release(forbid: dict[str, list[Src]], tag: str) -> dict[str, list[Src]]:
    """Stop forbidding `tag` but keep the rest of its family: "veg, but egg chalega" keeps meat, fish and gelatin out."""
    out = {f: s for f, s in forbid.items() if f != tag}
    for general in [f for f in out if _covers(f, tag)]:
        sources = out.pop(general)
        for child in _children(general):
            if child == tag:
                continue
            family = release({child: sources}, tag) if _covers(child, tag) else {child: sources}
            out = {**family, **out}
    return out


def clean_time_rule(rule: dict[str, Any]) -> dict[str, Any]:
    """A TimeRule as stored: the phone's label and via never reach the database."""
    return {k: rule[k] for k in TIME_RULE_KEYS if k in rule}


def _tier(tag: str, sources: list[Src], allergens: dict[str, Any]) -> str:
    if tag in allergens:
        return "hard"
    tiers = [s.tier or tier_for(tag) for s in sources]
    return max(tiers, key=lambda t: TIER_ORDER[t])


def _from_presets(reading: words.Reading) -> tuple[dict[str, list[Src]], dict[str, tuple[str, str]], list[str]]:
    r = engine.rules()
    forbid: dict[str, list[Src]] = {}
    allow: dict[str, tuple[str, str]] = {}
    presets: list[str] = []
    for preset_id, word, soft in reading.presets:
        preset = r.presets[preset_id]
        presets.append(preset_id)
        tier = "firm" if preset_id == DIABETIC else ("soft" if soft else None)
        via = _via(word, preset["labels"]["en"].lower())
        for tag in preset["forbid"]:
            forbid = {**forbid, tag: [*forbid.get(tag, []), Src(via, tier)]}
        for tag in preset["allow"]:
            allow.setdefault(tag, (via, "dictionary"))
    return forbid, allow, list(dict.fromkeys(presets))


def _with_model(extra: dict[str, Any], forbid: dict[str, list[Src]], allow: dict[str, tuple[str, str]],
                allergens: dict[str, Src]) -> tuple[dict[str, list[Src]], dict[str, tuple[str, str]], dict[str, Src]]:
    """The model may add tags the dictionary missed; it never removes or weakens one."""
    allergens = {**{t: Src(_label(t), "hard", "model") for t in extra.get("allergens", [])}, **allergens}
    for name, tier in (("forbid", None), ("soft", "soft")):
        for tag in extra.get(name, []):
            if tag not in allergens and not any(_covers(f, tag) for f in forbid):
                forbid = {**forbid, tag: [Src(_label(tag), tier, "model")]}
    for tag in extra.get("allow", []):
        if tag not in allow and not any(_covers(f, tag) for f in [*forbid, *allergens]):
            allow = {**allow, tag: (_label(tag), "model")}
    return forbid, allow, allergens


def assemble(reading: words.Reading, extra: dict[str, Any] | None = None) -> dict[str, Any]:
    forbid, allow, presets = _from_presets(reading)
    explicit_forbid: set[str] = set()
    explicit_allow: dict[str, str] = {}
    allergens: dict[str, Src] = {}
    for food in reading.foods:
        for tag in food.tags:
            via = _via(food.word, _label(tag))
            if food.polarity == "allergen":
                allergens.setdefault(tag, Src(via, "hard"))
            elif food.polarity == "forbid":
                explicit_forbid.add(tag)
                forbid = {**forbid, tag: [*forbid.get(tag, []), Src(via, "soft" if food.soft else None)]}
            elif food.polarity == "allow":
                explicit_allow.setdefault(tag, via)

    strict = explicit_forbid | set(allergens)
    for tag, via in explicit_allow.items():
        if any(_covers(f, tag) for f in strict):
            continue  # "no egg" and "egg OK" in one message: the "no" wins
        if any(_covers(f, tag) for f in forbid):
            forbid = release(forbid, tag)
        allow = {**allow, tag: (via, "dictionary")}

    if extra:
        forbid, allow, allergens = _with_model(extra, forbid, allow, allergens)

    every = {**forbid, **{a: [s] for a, s in allergens.items()}}
    keep =[t for t in every if t in allergens or not any(g != t and _covers(g, t) for g in every)]
    final_allow = [a for a in allow if not any(_covers(f, a) for f in keep)]
    tiers = {t: _tier(t, every[t], allergens) for t in keep}
    flex = bool(reading.flex or (extra or {}).get("flex")) and "hard" not in tiers.values()

    chips = [
        {"tag": t, "kind": "allergen" if t in allergens else "forbid", "tier": tiers[t], "via": every[t][0].via,
         "source": every[t][0].source}
        for t in keep
    ] + [{"tag": a, "kind": "allow", "tier": None, "via": allow[a][0], "source": allow[a][1]} for a in final_allow]

    rules = {
        "forbid": keep,
        "allow": final_allow,
        "allergens": list(allergens),
        "tiers": tiers,
        "flex": flex,
        "time_rules": [clean_time_rule(t) for t in reading.time_rules],
    }
    dictionary_found = bool(reading.presets or reading.foods or reading.time_rules or reading.flex)
    source = "dictionary" if extra is None else ("both" if dictionary_found else "model")
    return {
        "rules": rules,
        "chips": chips,
        "time_rules": reading.time_rules,
        "unclear": reading.unclear,
        "source": source,
        "presets": presets,
    }


def understand(text: str, lang: str | None = None) -> dict[str, Any]:
    """Read one message: dictionary first, the extraction model second (only with a key). Stores nothing."""
    return assemble(words.read(text), model.try_read(text, lang))
