"""m4 · lost-meal watcher. Owned by the m4 owner (see docs/plan/modules/)."""
from .router import router
from .seed import seed
from .watcher import ingest, simulate

__all__ = ["router", "seed", "ingest", "simulate"]
