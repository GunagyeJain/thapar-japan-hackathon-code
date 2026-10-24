"""FastAPI app. Shared zone: add, don't rewrite.

Dev:  uvicorn on :8000, Vite on :5173 proxies /api here.
Demo: after `npm run build`, this also serves frontend/dist on :8000 (one origin for the tunnel).
"""
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.core.paths import FRONTEND_DIST, REPO_ROOT

load_dotenv(REPO_ROOT / ".env")

from app.core.db import create_tables  # noqa: E402
from app.core.seed import ensure_seeded  # noqa: E402
from app.registry import MODULES  # noqa: E402


@asynccontextmanager
async def lifespan(_app: FastAPI):
    create_tables()
    ensure_seeded()
    yield


app = FastAPI(
    title="ThaliBento API",
    version="0.1.0",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
    openapi_tags=[
        {"name": tag, "description": f"Module {m.id}: {m.name}"} for m in MODULES for tag in m.router.tags
    ],
)

for module in MODULES:
    app.include_router(module.router)


if (FRONTEND_DIST / "index.html").exists():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str) -> FileResponse:
        if path.startswith("api/"):
            raise HTTPException(404, "Not found")
        file = (FRONTEND_DIST / path).resolve()
        if path and file.is_file() and FRONTEND_DIST.resolve() in file.parents:
            return FileResponse(file)
        return FileResponse(FRONTEND_DIST / "index.html")
