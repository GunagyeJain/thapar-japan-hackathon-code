# m0: foundation

**Owner:** Gunagye (lane a) · **Branch:** `gunagye/m0-foundation` · **Phase:** start, 15:40–17:00 IST (ship the contracts after T2)
**Status:** in progress <!-- not started | in progress | blocked: <why> | done -->

## Goal
Everything the other modules build on, on main within an hour:
- a running app shell showing live JL740 data
- the contracts from `shared/` turned into code
- every module's folder, route and router already wired
- checks that run on every ship

At the 16:30 mentor checkpoint, this is what we show running.

## Owns
- Scaffold: `frontend/` (Vite React TS), `backend/` (FastAPI), root `package.json`, `.env.example`, README "Run it"
- `backend/app/core/`, `backend/app/main.py`, `backend/app/registry.py`. These become shared zone once m0 ships.
- `frontend/src/app/` (providers, `routes.tsx`, `nav.ts`), `frontend/src/lib/api.ts`, `clock.ts`, `i18n.ts`, `format.ts`
- `frontend/src/ui/` and `frontend/src/app/layouts/` base versions (m2 takes them over)
- `frontend/src/modules/m0-home/`
- `shared/seed/*.json` base files and their generator `backend/app/core/seed_gen.py`
- the "Project checks" section of `scripts/check.sh`

## Uses (contracts it reads)
- `shared/README.md` (entities, seed cast, who writes what) and `shared/api.md` (m0 endpoints)

## Provides (what others rely on)
- **Core tables and helpers** exactly as listed in `shared/README.md`: `clock`, `events.record_checkpoint`, `alerts.raise_alert`, `outbox.notify`, `registry.MODULES`.
- **Endpoints:** `/api/health`, `GET` and `POST /api/clock`, `/api/flights`, `/api/flights/{id}`, `/api/flights/{id}/passengers`, `/api/notifications`, `POST /api/demo/reset` (`keep_judges`; calls every module's `seed()` in order; bumps `seed_epoch`).
- **Frozen fields:** every field in `shared/README.md`, including `Flight.backup_count`, `CheckpointEvent.key` and the `seed_epoch` setting. SQLite in WAL mode.
- **Backend skeletons** for m1, m3, m4, m6–m11 and m14: `backend/app/modules/mN_slug/{__init__.py, router.py, seed.py}`. Each has an empty `APIRouter(prefix="/api")` and `def seed(session): pass`, and is registered in `registry.py`.
- **Frontend placeholders:** `frontend/src/modules/mN-slug/index.tsx` for every route in PLAN.md (`/rules`, `/p`, `/j`, `/ops`, `/caterer`, `/caterer/recipes`, `/crew`, `/insights`, `/demo`, `/groups`, `/ui`), each with its nav entry.
- **Layouts:** `DesktopLayout` (left nav + header slot), `MobileLayout`, `TabletLayout` (dark).
- **Client helpers:**
  - `useSimClock()`: polls `/api/clock`, ticks locally.
  - `api.get/post`: typed fetch wrapper with `{detail}` errors.
  - `fmtTime(iso, "IST"|"JST")`.
  - `t(text, lang)`.
- **Scripts:**
  - `npm run dev`: uvicorn :8000 + vite :5173 with an `/api` proxy.
  - `npm run demo`: build, then FastAPI serves `frontend/dist` on :8000.

## Tasks
- [x] **T1 Scaffold (25 min).**
  - Frontend: Vite React-TS, Tailwind v4, shadcn/ui (button, input, checkbox, card, badge, tabs, dialog, sonner, table), React Router, TanStack Query, `@fontsource` Archivo / Inter / Noto Sans JP / Hind, vitest.
  - Backend: FastAPI + SQLModel (SQLite at `backend/data/thalibento.db`, add `backend/data/` to `.gitignore`), ortools, pytest; `backend/requirements.txt` installed with `uv`.
  - Root `package.json` with `concurrently`. If a brand-new major version breaks the build, pin the previous major.

  _Done when:_ `npm run dev` serves `/` and `GET /api/health` returns `{ok: true}`.
- [x] **T2 Contracts in code (20 min).** Core models + helpers, registry, every backend skeleton, every frontend placeholder and nav entry.

  _Done when:_ every route renders its placeholder, `/api/docs` lists every module's router, and `POST /api/demo/reset` works. **Ship right away** (heads-up: "core models, registries and module folders are on main"). The others start from this.
- [x] **T3 Seed + home (15 min).**
  - `seed_gen.py` writes deterministic `shared/seed/*.json`: 186 passengers with the named cast, profiles + promises for the cast, specs, and items with fixed `TB-` ids. They load on startup and on every module's `seed()`.
  - Home page:
    - JL740 card (DEL 04:35 IST → NRT 15:20 JST, B787-8)
    - counts
    - a countdown to the caterer's final list on the sim clock
    - a dual IST/JST clock
    - one tile per surface

  _Done when:_ home shows "JL740 · 186 passengers · 22+ special meals" and the countdown moves.
- [ ] **T4 Checks + docs (10 min).**
  - `check.sh` project checks: `tsc --noEmit`, `npm run build`, vitest, pytest.
  - README "Run it" for Windows and macOS (`uv venv --python 3.12 backend/.venv`, `uv pip install -r backend/requirements.txt`, Node 20+, `npm install`, `npm run dev`).
  - `.env.example` with `GEMINI_API_KEY=` and `GEMINI_MODEL=gemini-2.5-flash`.

  _Done when:_ `bash scripts/check.sh` passes. Ship with the heads-up "run npm install, then the uv commands in README".

## Done when
A teammate on a fresh laptop follows README "Run it" and sees the JL740 home page and the placeholder for their module, and `bash scripts/check.sh` passes.

## Notes
_Owner's running notes._
- Every module's frontend folder has `index.tsx` exporting `routes: ModuleRoute[]` (`{path, layout: "desktop"|"mobile"|"tablet", element}`). Replace the placeholder element; keep the export.
- Every backend skeleton has a `GET /api/mN/status` placeholder so it shows in `/api/docs`. Delete it when real endpoints land.
- Core types for the frontend are in `frontend/src/lib/types.ts` (shared zone, add-only).
- Seed data: `npm run seed` regenerates `shared/seed/*.json` deterministically; reset reloads it.
