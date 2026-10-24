from fastapi import APIRouter

router = APIRouter(prefix="/api", tags=["m10 · insights"])


@router.get("/m10/status")
def status() -> dict:
    """Placeholder so this router shows in /api/docs. Delete it once real endpoints exist."""
    return {"module": "m10", "ready": False}
