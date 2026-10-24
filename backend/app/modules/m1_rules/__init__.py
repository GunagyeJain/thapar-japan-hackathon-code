"""m1 · rules engine. Owned by the m1 owner (see docs/plan/modules/)."""
from .router import router
from .seed import seed

__all__ = ["router", "seed"]
