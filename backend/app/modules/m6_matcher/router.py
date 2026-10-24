from fastapi import APIRouter

router = APIRouter(prefix="/api", tags=["m6 · late-request matcher"])


@router.get("/m6/status")
def status() -> dict:
    """Placeholder so this router shows in /api/docs. Delete it once real endpoints exist."""
    return {"module": "m6", "ready": False}
