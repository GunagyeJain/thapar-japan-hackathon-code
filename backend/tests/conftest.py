import os
import tempfile
from pathlib import Path

import pytest

# Tests use their own database, never backend/data/thalibento.db.
os.environ.setdefault("THALIBENTO_DB", str(Path(tempfile.mkdtemp()) / "test.db"))

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as c:
        yield c
