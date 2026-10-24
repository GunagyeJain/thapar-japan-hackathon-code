# backend/

FastAPI + SQLModel on SQLite (WAL mode). Setup and run: see "Run it" in the root README.

```bash
uv venv --python 3.12 backend/.venv
uv pip install --python backend/.venv -r backend/requirements.txt
```

- `app/main.py`: the app; includes every router in `app/registry.py` and, after `npm run build`, serves `frontend/dist`.
- `app/core/`: core models (`models.py`), sim clock (`clock.now()`), `events.record_checkpoint`, `alerts.raise_alert`, `outbox.notify`, seed and reset. Shared zone.
- `app/modules/mN_slug/`: one package per module (`router.py` with `APIRouter(prefix="/api")`, `seed.py` with `seed(session)`), owned by that module's owner.
- `tests/`: pytest, `test_mN_*.py` per module. Tests use a temporary database.

Inside an endpoint that writes, use `session: SessionDep` (from `app.core.db`) and pass `session=session` to the core helpers, then `session.commit()`.
