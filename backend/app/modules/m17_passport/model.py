"""The extraction model reads a diet sentence into taxonomy tags. Optional: only runs with GEMINI_API_KEY set.

The dictionary reader carries the demo on its own. The model may only add tags it can name from the taxonomy;
it never removes what the dictionary found. Answers are cached in memory by a hash of the sentence, never on disk.
"""
import enum
import hashlib
import logging
import os
import threading
from functools import lru_cache
from typing import Any

from pydantic import BaseModel, Field, ValidationError, create_model

from app.modules.m1_rules import engine
from app.modules.m9_recipes.gemini import ModelUnavailable, has_key, model_name

log = logging.getLogger(__name__)

TIMEOUT_MS = 8_000  # a chat answer can't wait long; on timeout the dictionary answers alone
CACHE_MAX = 256
LISTS = ("forbid", "allow", "allergens", "soft")

_cache: dict[str, dict[str, Any]] = {}
_lock = threading.Lock()


@lru_cache(maxsize=1)
def tag_ids() -> list[str]:
    return sorted(t for t, v in engine.rules().tags.items() if v.get("kind") not in ("property", "rule"))


@lru_cache(maxsize=1)
def _schema() -> type[BaseModel]:
    """forbid / allow / allergens / soft as lists of taxonomy ids only (an enum), plus flex."""
    tag_enum = enum.Enum("TagId", [(t, t) for t in tag_ids()], type=str)
    fields: dict[str, Any] = {name: (list[tag_enum], Field(default_factory=list)) for name in LISTS}
    return create_model("DietReading", flex=(bool, False), **fields)


def _prompt(text: str, lang: str | None) -> str:
    return (
        "A passenger describes what they eat, in their own words and language"
        + (f" (the app is set to '{lang}')" if lang else "")
        + ". Return, using taxonomy ids only:\n"
        "- forbid: foods they never eat\n- allow: foods they say they do eat\n"
        "- allergens: foods they are allergic to\n- soft: foods they would only prefer to avoid\n"
        "- flex: true only if they say they eat anything\n"
        "Only what the text says. Never infer anything from a religion, a festival or a name.\n"
        f"Taxonomy ids: {', '.join(tag_ids())}.\n"
        f"Text: <<<{text}>>>"
    )


def _key(text: str) -> str:
    return hashlib.sha256(text.strip().lower().encode("utf-8")).hexdigest()


def _clean(raw: dict[str, Any]) -> dict[str, Any]:
    known = set(tag_ids())
    out: dict[str, Any] = {"flex": bool(raw.get("flex"))}
    for name in LISTS:
        values = [getattr(v, "value", v) for v in raw.get(name) or []]
        out[name] = [v for v in dict.fromkeys(values) if v in known]
    return out


def read(text: str, lang: str | None = None) -> dict[str, Any]:
    """{forbid, allow, allergens, soft, flex} from the extraction model, or raises ModelUnavailable."""
    if not has_key():
        raise ModelUnavailable("No GEMINI_API_KEY in .env")
    key = _key(text)
    with _lock:
        if key in _cache:
            return _cache[key]
    try:
        from google import genai
        from google.genai import errors, types
    except ImportError as exc:  # pragma: no cover - dependency missing on this laptop
        raise ModelUnavailable("google-genai isn't installed") from exc

    schema = _schema()
    client = genai.Client(api_key=os.environ["GEMINI_API_KEY"].strip(), http_options=types.HttpOptions(timeout=TIMEOUT_MS))
    try:
        response = client.models.generate_content(
            model=model_name(),
            contents=[_prompt(text, lang)],
            config=types.GenerateContentConfig(
                temperature=0,
                thinking_config=types.ThinkingConfig(thinking_level=types.ThinkingLevel.LOW),
                response_mime_type="application/json",
                response_schema=schema,
            ),
        )
        reading = _clean(schema.model_validate_json(response.text or "").model_dump())
    except errors.APIError as exc:
        raise ModelUnavailable(f"Extraction model error {exc.code}") from exc
    except ValidationError as exc:
        raise ModelUnavailable("The extraction model's answer didn't fit the schema") from exc
    except Exception as exc:  # network down, timeout
        raise ModelUnavailable(f"Couldn't reach the extraction model: {type(exc).__name__}") from exc
    with _lock:
        if len(_cache) >= CACHE_MAX:
            _cache.pop(next(iter(_cache)))
        _cache[key] = reading
    return reading


def try_read(text: str, lang: str | None = None) -> dict[str, Any] | None:
    """The model's reading, or None when it isn't set up or doesn't answer in time (the dictionary answers alone)."""
    try:
        return read(text, lang)
    except ModelUnavailable as exc:
        if has_key():
            log.warning("Extraction model skipped: %s", exc)
        return None
