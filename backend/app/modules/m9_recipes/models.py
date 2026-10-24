"""m9 tables."""
from datetime import datetime
from typing import Any

from sqlmodel import Field, SQLModel

from app.core.db import TZDateTime, json_col


class RecipeSheet(SQLModel, table=True):
    id: str = Field(primary_key=True)  # RS-…
    name: dict[str, str] = Field(default_factory=dict, sa_column=json_col())  # {en, ja}
    source_hash: str = Field(index=True)
    cached: bool = False
    engine: str  # dictionary | gemini | dictionary+gemini
    ingredients: list[dict[str, Any]] = Field(default_factory=list, sa_column=json_col())
    verdicts: list[dict[str, Any]] = Field(default_factory=list, sa_column=json_col())
    status: str = "needs_review"  # needs_review | approved
    created_at: datetime = Field(sa_type=TZDateTime)
    # Optional extras (not in the v1 contract): the sheet text for the side-by-side view,
    # why the model wasn't used, and the spec an approval created.
    text: str | None = None
    model_note: str | None = None
    spec_id: str | None = None
    approved_by: str | None = None
