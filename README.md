# ThaliBento · JAL-PS-01

Prototype for the **Thapar Japan Hackathon 2026** (offline round, 24–25 Oct, TIET Patiala).
Track: **In-Flight Hospitality & Dietary Intelligence** (Japan Airlines).
Team **Caffeinated Nerds**: Bhavyam Misra · Gunagye Jain · Shefali Sharma.

## Repo layout
```
frontend/   React + Vite app; each module has its own folder in src/modules/
backend/    FastAPI + SQLite; each module has its own package in app/modules/
shared/     contracts every module builds against: data schema, API types, seed data
docs/
  plan/     PLAN.md (master plan) + modules/ (one spec per module, kept up to date by its owner)
  changelog.md   one line per ship to main (written by scripts/ship.sh)
  decisions.md   dated decisions
scripts/    team git helpers: start, sync, ship, radar, check
```

## Run it
You need **Git**, **Node 20+** (`node -v`) and **uv** (`uv --version`). uv downloads Python 3.12 for you.
- Windows: run everything below in **Git Bash**. Install uv with `powershell -c "irm https://astral.sh/uv/install.ps1 | iex"`.
- macOS: `brew install uv node` (or `curl -LsSf https://astral.sh/uv/install.sh | sh`).

**Once per laptop** (from the repo root):
```bash
uv venv --python 3.12 backend/.venv
uv pip install --python backend/.venv -r backend/requirements.txt
npm install                     # root + frontend (runs npm install in frontend/ too)
cp .env.example .env            # then paste the real keys from the team chat
```

**Every day:**
```bash
npm run dev
```
- App: http://localhost:5173 (Vite; `/api` is proxied to the backend). Your module's page is at its route, e.g. `/ops`, `/p`, `/crew`.
- API: http://localhost:8000/api/docs
- Stop with Ctrl+C. The database (`backend/data/thalibento.db`) seeds itself on first start; `POST /api/demo/reset` reseeds it in under a second.

| You want to | Run |
|---|---|
| All checks (same as ship) | `bash scripts/check.sh` |
| Tests only | `npm test` |
| Regenerate `shared/seed/*.json` | `npm run seed` |
| Demo build: one origin on :8000 (for the tunnel) | `npm run demo` |
| Clean checkout to a running demo in one go (installs, builds, prints the judge and tunnel addresses) | `bash scripts/demo.sh` (add `--reset` for fresh data) |
| After a sync changed `requirements.txt` | `uv pip install --python backend/.venv -r backend/requirements.txt` |
| After a sync changed a `package.json` | `npm install` |
| Port 8000 or 5173 already in use | stop the old `npm run dev`; on Windows `netstat -ano \| findstr :8000`, then `taskkill /PID <pid> /T /F` |

**Where things go:** your module's frontend is `frontend/src/modules/<module>/` (its `index.tsx` exports `routes`), its backend is `backend/app/modules/<module>/` (`router.py`, `seed.py`). Core models and helpers (`clock`, `events`, `alerts`, `outbox`) are in `backend/app/core/`; frontend helpers in `frontend/src/lib/` (`api`, `clock`, `format`, `i18n`, `types`).

## How we work
Full rules are in [CONTRIBUTING.md](CONTRIBUTING.md). Short version:
```bash
bash scripts/start.sh <your-name> <module>   # once per module, e.g. gunagye m3
# ...code, commit...
bash scripts/sync.sh                         # pull in teammates' shipped work
bash scripts/ship.sh "what works now"        # merge your branch into main
bash scripts/radar.sh                        # who is on what, and any overlaps
```
