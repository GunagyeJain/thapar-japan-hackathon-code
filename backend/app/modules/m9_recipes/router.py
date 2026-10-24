from fastapi import APIRouter

router = APIRouter(prefix="/api", tags=["m9 · hidden-ingredient check"])


@router.get("/m9/status")
def status() -> dict:
    """Placeholder so this router shows in /api/docs. Delete it once real endpoints exist."""
    return {"module": "m9", "ready": False}
