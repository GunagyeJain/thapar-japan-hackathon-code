"""Gemini reads a recipe sheet into a fixed schema. It only reads; the rules engine decides."""
import os
from functools import lru_cache

from pydantic import BaseModel, Field, ValidationError

from app.modules.m1_rules import engine

TIMEOUT_MS = 25_000


class ModelUnavailable(Exception):
    """No key, no network, or an answer that doesn't fit the schema. The caller falls back to the dictionary."""


class Ingredient(BaseModel):
    name_ja: str
    name_en: str = ""
    tags: list[str] = Field(default_factory=list)
    confidence: float = Field(ge=0, le=1)
    evidence: str = ""


class Extraction(BaseModel):
    dish_name_ja: str = ""
    dish_name_en: str = ""
    # For a photo: the sheet's text as written, so the dictionary pass can read it too.
    transcription: str = ""
    ingredients: list[Ingredient]


def model_name() -> str:
    return os.environ.get("GEMINI_MODEL") or "gemini-2.5-flash"


def has_key() -> bool:
    return bool(os.environ.get("GEMINI_API_KEY", "").strip())


@lru_cache(maxsize=1)
def _prompt() -> str:
    tags = ", ".join(sorted(t for t, v in engine.rules().tags.items() if v.get("kind") != "property"))
    return (
        "You read Japanese airline-catering recipe sheets for a food-safety check.\n"
        "List every ingredient, including what is inside compound items: soup stock (出汁, つゆ), "
        "sauces, curry roux, batter, seasonings and anything a step adds that the list leaves out.\n"
        "For each ingredient give name_ja as written, name_en in plain English, tags from this list only "
        f"(use the most specific one that fits; an empty list if none fits): {tags}.\n"
        "confidence is how sure you are of the tags (0 to 1). evidence is the exact text you read it from.\n"
        "transcription is the full sheet text exactly as written (for a photo; for text, leave it empty).\n"
        "Do not judge whether the dish suits any diet. Only report what is in it."
    )


def extract(*, text: str | None = None, image: bytes | None = None, mime_type: str = "image/png") -> dict:
    """One Gemini call. Returns an Extraction as a dict, or raises ModelUnavailable."""
    if not has_key():
        raise ModelUnavailable("No GEMINI_API_KEY in .env")
    try:
        from google import genai
        from google.genai import errors, types
    except ImportError as exc:  # pragma: no cover - dependency missing on this laptop
        raise ModelUnavailable("google-genai isn't installed (uv pip install -r backend/requirements.txt)") from exc

    client = genai.Client(api_key=os.environ["GEMINI_API_KEY"].strip(), http_options=types.HttpOptions(timeout=TIMEOUT_MS))
    contents: list = [types.Part.from_bytes(data=image, mime_type=mime_type)] if image else [text or ""]
    contents.append(_prompt())
    try:
        response = client.models.generate_content(
            model=model_name(),
            contents=contents,
            config=types.GenerateContentConfig(
                temperature=0,
                response_mime_type="application/json",
                response_schema=Extraction,
            ),
        )
    except errors.APIError as exc:
        raise ModelUnavailable(f"Gemini error {exc.code}: {exc.message}") from exc
    except Exception as exc:  # network down, timeout
        raise ModelUnavailable(f"Couldn't reach Gemini: {type(exc).__name__}") from exc
    try:
        return Extraction.model_validate_json(response.text or "").model_dump()
    except ValidationError as exc:
        raise ModelUnavailable("Gemini's answer didn't fit the schema") from exc
