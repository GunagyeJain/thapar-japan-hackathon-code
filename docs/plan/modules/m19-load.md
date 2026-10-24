# m19: Smart Load

**Owner:** Gunagye (lane b, built in parallel) · **Branch:** `gunagye/m16-days` (v2 integration) · **Phase:** v2, 25 Oct 00:30–04:00 IST
**Status:** in progress <!-- not started | in progress | blocked: <why> | done -->

## Goal
Load for the cabin we'll actually have: demand per diet family (what passports tell us, plus a forecast for the passengers who told us nothing), a reserve sized by the newsvendor rule where a never-spoiling pouch makes almost full cover affordable, the universal plate that suits 13 of 13 diets on this route (computed live by the rules engine), and sealed-cup thali-bento spares chosen by set cover. Screen `/ops/load`. Spec: `docs/plan/v2.md`.

## Owns
- `backend/app/modules/m19_load/`, `backend/tests/test_m19_*.py`
- `frontend/src/modules/m19-load/`
- the universal-plate reserve spec in the core seed (`SPEC-BACKUP` becomes the retort universal plate) and the taxonomy tags it needs

## Provides
`GET /api/load/{flight_id}` (`shared/api.md`, `## m19`).

## Notes
