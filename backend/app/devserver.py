"""Dev server target for `npm run dev`: watchfiles restarts this process when backend/app changes.

(uvicorn's own --reload hangs on Windows when started from Node, so we don't use it.)
"""
import uvicorn


def run() -> None:
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000)
