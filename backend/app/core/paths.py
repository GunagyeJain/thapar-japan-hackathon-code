import os
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
BACKEND_DIR = REPO_ROOT / "backend"
SHARED_DIR = REPO_ROOT / "shared"
SEED_DIR = SHARED_DIR / "seed"
FRONTEND_DIST = REPO_ROOT / "frontend" / "dist"
DB_PATH = Path(os.environ.get("THALIBENTO_DB", BACKEND_DIR / "data" / "thalibento.db"))
