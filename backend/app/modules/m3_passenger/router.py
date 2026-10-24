from fastapi import APIRouter

router = APIRouter(prefix="/api", tags=["m3 · passenger + judge join"])


@router.get("/m3/status")
def status() -> dict:
    """Placeholder so this router shows in /api/docs. Delete it once real endpoints exist."""
    return {"module": "m3", "ready": False}
