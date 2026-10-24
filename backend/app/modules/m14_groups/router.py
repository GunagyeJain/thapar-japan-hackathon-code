from fastapi import APIRouter

router = APIRouter(prefix="/api", tags=["m14 · groups"])


@router.get("/m14/status")
def status() -> dict:
    """Placeholder so this router shows in /api/docs. Delete it once real endpoints exist."""
    return {"module": "m14", "ready": False}
