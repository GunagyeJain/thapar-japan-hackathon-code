from fastapi import APIRouter

router = APIRouter(prefix="/api", tags=["m7 · caterer"])


@router.get("/m7/status")
def status() -> dict:
    """Placeholder so this router shows in /api/docs. Delete it once real endpoints exist."""
    return {"module": "m7", "ready": False}
