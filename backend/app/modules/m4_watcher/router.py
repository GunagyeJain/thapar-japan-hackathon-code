from fastapi import APIRouter

router = APIRouter(prefix="/api", tags=["m4 · lost-meal watcher"])


@router.get("/m4/status")
def status() -> dict:
    """Placeholder so this router shows in /api/docs. Delete it once real endpoints exist."""
    return {"module": "m4", "ready": False}
