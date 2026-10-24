"""m9 endpoints: read a Japanese recipe sheet, show per-diet verdicts, approve it as a meal spec."""
from typing import Annotated, Any

from fastapi import APIRouter, HTTPException, Request
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, StringConstraints, ValidationError
from sqlmodel import select
from starlette.datastructures import UploadFile

from app.core import clock
from app.core.db import SessionDep
from app.core.ids import new_id
from app.core.models import MealSpec

from . import evaluation, pipeline
from .models import RecipeSheet

router = APIRouter(prefix="/api", tags=["m9 · hidden-ingredient check"])

MAX_TEXT = 20_000
MAX_IMAGE = 8 * 1024 * 1024
IMAGE_TYPES = {"image/png", "image/jpeg", "image/webp"}


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
    """Body is JSON `{text, name?}` (a pasted sheet) or multipart `file` (a photo of one)."""
    name_hint = None
    if request.headers.get("content-type", "").startswith("multipart/"):
        form = await request.form()
        upload = form.get("file")
        if not isinstance(upload, UploadFile):
            raise HTTPException(status_code=422, detail="Send the photo as the multipart field `file`")
        mime = upload.content_type or ""
        if mime not in IMAGE_TYPES:
            raise HTTPException(status_code=415, detail="Send a PNG, JPEG or WebP photo of the sheet")
        data = await upload.read(MAX_IMAGE + 1)
        if len(data) > MAX_IMAGE:
            raise HTTPException(status_code=413, detail="The photo is over 8 MB")
        is_image = True
    else:
        try:
            body = ExtractText.model_validate(await request.json())
        except (ValueError, ValidationError) as exc:
            raise HTTPException(status_code=422, detail="Send {text, name?} with the recipe sheet's text") from exc
        data, mime, is_image, name_hint = body.text.encode("utf-8"), "text/plain", False, body.name

    try:
        # Gemini can take seconds: keep it off the event loop.
        result = await run_in_threadpool(pipeline.run, data, is_image=is_image, mime_type=mime)
    except pipeline.PhotoNeedsModel as exc:
        raise HTTPException(status_code=503, detail=f"{exc}. Paste the sheet's text instead.") from exc

    ja = result["dish_name_ja"] or name_hint or ""
    sheet = RecipeSheet(
        id=new_id("RS"),
        name={"en": result["dish_name_en"] or name_hint or ja or "Recipe", "ja": ja},
        source_hash=result["source_hash"],
        cached=result["cached"],
        engine=result["engine"],
        ingredients=result["ingredients"],
        verdicts=result["verdicts"],
        created_at=clock.now(session=session),
        text=result["text"] or None,
        model_note=result["model_note"],
    )
    session.add(sheet)
    session.commit()
    return _out(sheet)


@router.get("/recipes")
def list_sheets(session: SessionDep) -> list[dict[str, Any]]:
    rows = session.exec(select(RecipeSheet).order_by(RecipeSheet.created_at.desc())).all()  # type: ignore[attr-defined]
    return [_out(r) for r in rows]


@router.get("/recipes/eval")
def eval_table() -> dict[str, Any]:
    """Dictionary vs model vs both on the hand-labelled sheets in eval.json. Reads the cache only."""
    return evaluation.table()


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
