from fastapi import APIRouter

router = APIRouter(prefix="/api", tags=["m1 · rules engine"])


@router.get("/m1/status")
def status() -> dict:
    """Placeholder so this router shows in /api/docs. Delete it once real endpoints exist."""
    return {"module": "m1", "ready": False}
