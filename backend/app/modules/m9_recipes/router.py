"""m9 endpoints: read a Japanese recipe sheet, show per-diet verdicts, approve it as a meal spec."""
from typing import Annotated, Any

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, StringConstraints, ValidationError
from sqlmodel import select

from app.core import clock
from app.core.db import SessionDep
from app.core.ids import new_id
from app.core.models import MealSpec

from . import pipeline
from .models import RecipeSheet

router = APIRouter(prefix="/api", tags=["m9 · hidden-ingredient check"])

MAX_TEXT = 20_000


class ExtractText(BaseModel):
    text: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=MAX_TEXT)]
    name: Annotated[str, StringConstraints(strip_whitespace=True, max_length=120)] | None = None


class ApproveIn(BaseModel):
    by: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=60)]


def _out(sheet: RecipeSheet) -> dict[str, Any]:
    data = sheet.model_dump()
    # `words` is internal (the exact dictionary hits); the contract row is the rest.
    data["ingredients"] = [{k: v for k, v in row.items() if k != "words"} for row in sheet.ingredients]
    return data


@router.post("/recipes/extract")
async def extract(request: Request, session: SessionDep) -> dict[str, Any]:
    """Body is JSON `{text, name?}` (a pasted sheet) or multipart `file` (a photo, needs the model)."""
    if request.headers.get("content-type", "").startswith("multipart/"):
        raise HTTPException(status_code=503, detail="Reading a photo needs the model. Paste the sheet's text instead.")
    try:
        body = ExtractText.model_validate(await request.json())
    except (ValueError, ValidationError) as exc:
        raise HTTPException(status_code=422, detail="Send {text, name?} with the recipe sheet's text") from exc

    result = pipeline.dictionary_only(body.text)
    name = {"en": result["dish_name_en"] or body.name or result["dish_name_ja"] or "Recipe", "ja": result["dish_name_ja"] or body.name or ""}
    sheet = RecipeSheet(
        id=new_id("RS"),
        name=name,
        source_hash=pipeline.source_hash(body.text.encode("utf-8")),
        cached=False,
        engine="dictionary",
        ingredients=result["ingredients"],
        verdicts=result["verdicts"],
        created_at=clock.now(session=session),
        text=body.text,
        model_note="Model offline: dictionary only",
    )
    session.add(sheet)
    session.commit()
    return _out(sheet)


@router.get("/recipes")
def list_sheets(session: SessionDep) -> list[dict[str, Any]]:
    rows = session.exec(select(RecipeSheet).order_by(RecipeSheet.created_at.desc())).all()  # type: ignore[attr-defined]
    return [_out(r) for r in rows]


@router.get("/recipes/{sheet_id}")
def get_sheet(sheet_id: str, session: SessionDep) -> dict[str, Any]:
    sheet = session.get(RecipeSheet, sheet_id)
    if sheet is None:
        raise HTTPException(status_code=404, detail=f"No recipe sheet {sheet_id}")
    return _out(sheet)


@router.post("/recipes/{sheet_id}/approve")
def approve(sheet_id: str, body: ApproveIn, session: SessionDep) -> dict[str, Any]:
    """A person signs off: the dish becomes a MealSpec the matcher and crew can check against."""
    sheet = session.get(RecipeSheet, sheet_id)
    if sheet is None:
        raise HTTPException(status_code=404, detail=f"No recipe sheet {sheet_id}")
    spec = session.get(MealSpec, sheet.spec_id) if sheet.spec_id else None
    if spec is None:
        tags = list(dict.fromkeys(t for row in sheet.ingredients for t in row.get("tags", [])))
        spec = MealSpec(
            id=f"SPEC-R-{sheet.id[3:]}",
            name={k: v for k, v in sheet.name.items() if v},
            code=None,
            kind="main",
            tags=tags,
            certified=False,
            source="recipe_check",
        )
        session.add(spec)
    sheet.status = "approved"
    sheet.spec_id = spec.id
    sheet.approved_by = body.by
    session.add(sheet)
    session.commit()
    return {"sheet": _out(sheet), "spec": spec}
