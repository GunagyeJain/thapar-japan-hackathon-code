from fastapi import APIRouter

router = APIRouter(prefix="/api", tags=["m11 · story engine"])


@router.get("/m11/status")
def status() -> dict:
    """Placeholder so this router shows in /api/docs. Delete it once real endpoints exist."""
    return {"module": "m11", "ready": False}
