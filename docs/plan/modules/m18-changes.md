# m18: Change Router + Chaos Mode

**Owner:** Gunagye (lane b, built in parallel) · **Branch:** `gunagye/m16-days` (v2 integration) · **Phase:** v2, 25 Oct 00:30–04:00 IST
**Status:** in progress <!-- not started | in progress | blocked: <why> | done -->

## Goal
Every need that arrives after the cutoff (or that the airline's own systems drop) becomes one change event. The router works down a ladder and takes the first rung still physically possible for the time left (caterer list, standby uplift, lounge where allowed, onboard spare, no-show release, never-spoiling reserve pouch, flex swap), tells the passenger honestly, and logs what today's process would have done with the same event. Chaos Mode fires the scripted JL740 events; the metrics compare ThaliBento with today. Screens: `/ops/changes` (Change Control) and `/ops/desk` (Change Desk for check-in, lounge, gate and crew). Spec: `docs/plan/v2.md`.

## Owns
- `backend/app/modules/m18_changes/`, `backend/tests/test_m18_*.py`
- `frontend/src/modules/m18-changes/`

## Provides
`service.submit_change(...)`, `service.assignments(...)`; endpoints in `shared/api.md` (`## m18`).

## Done when
`POST /api/chaos/run` produces the seven events on the right rungs, `/ops/changes` shows them on the ladder with the passenger messages and the today column, and the metrics read from the run.

## Notes
