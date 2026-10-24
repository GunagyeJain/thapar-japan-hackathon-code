from fastapi import APIRouter

router = APIRouter(prefix="/api", tags=["m8 · crew tablet"])


@router.get("/m8/status")
def status() -> dict:
    """Placeholder so this router shows in /api/docs. Delete it once real endpoints exist."""
    return {"module": "m8", "ready": False}
