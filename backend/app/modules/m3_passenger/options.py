"""Meal-code options for a passenger's food rules, with a fallback when no standard code fits.

m1's code_options() only offers codes whose gaps a kitchen note can close. A long list
(every diet box plus allergies) can rule out all of them. Then we still order a meal: SPML,
the IATA "special meal, see note" code, with the note listing what to leave out.
"""
from typing import Any

from app.modules.m1_rules import engine

FALLBACK_CODE = "SPML"
NOTE_MAX = 60  # SSR free text has to fit one PNL line

FALLBACK_WHY = {
    "en": "No standard meal code covers all of these, so the kitchen makes a special meal from the note.",
    "hi": "कोई भी मानक मील कोड इन सब को कवर नहीं करता, इसलिए किचन नोट के अनुसार खास भोजन बनाएगा।",
    "ja": "すべての条件を満たす標準の機内食コードがないため、指示に沿って特別食をご用意します。",
}


def _word(tag: str) -> str:
    return tag.replace("_", " ").upper()


def fallback_note(forbid: list[str]) -> str:
    """"NO MEAT/SEAFOOD/EGG/PEANUT", cut to one PNL line with "+N MORE" when it's long.

    Tags another forbidden tag already covers (shrimp under seafood) are left out.
    """
    r = engine.rules()
    tags = list(dict.fromkeys(engine.check_tags(forbid)))
    words = [_word(t) for t in tags if not any(g != t and g in r.paths(t) for g in tags)]
    note = "NO " + words[0] if words else ""
    for i, w in enumerate(words[1:], start=1):
        more = f" +{len(words) - i} MORE"
        if len(f"{note}/{w}") > NOTE_MAX - (len(more) if i < len(words) - 1 else 0):
            return note + more
        note = f"{note}/{w}"
    return note


def fallback_option(forbid: list[str], allow: list[str]) -> dict[str, Any]:
    return {
        "code": FALLBACK_CODE,
        "recommended": True,
        "safety_gaps": [],
        "preference_losses": [],
        "kitchen_note": fallback_note(forbid),
        "label_mark": engine.label_mark(forbid, allow),
        "why": FALLBACK_WHY,
    }


def meal_options(forbid: list[str], allow: list[str]) -> list[dict[str, Any]]:
    """m1's options, best first; SPML with a full kitchen note when none fits."""
    return engine.code_options(forbid, allow) or [fallback_option(forbid, allow)]
