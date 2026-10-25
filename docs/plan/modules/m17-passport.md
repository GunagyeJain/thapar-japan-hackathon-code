# m17: Dietary Passport + Calendar Radar

**Owner:** Gunagye (lane b, built in parallel) · **Branch:** `gunagye/m16-days` (v2 integration) · **Phase:** v2, 25 Oct 00:30–04:00 IST
**Status:** done <!-- not started | in progress | blocked: <why> | done -->

## Goal
A passenger's food rules, saved once from the special-meal form on `/jal` (m23): strictness tiers (hard / firm / soft), time rules (fast dates, weekday vows, daylight-only eating) and a flex opt-in. The rules engine picks the main-menu dish to hold or the nearest JAL code + kitchen note. The passport belongs to the person, survives rebooking and covers the whole booking. The Calendar Radar checks each trip date against the time rules and asks one tap-to-answer question before the cutoff. Spec: `docs/plan/v2.md`.

## Owns
- `backend/app/modules/m17_passport/`, `backend/tests/test_m17_*.py`
- `frontend/src/modules/m17-passport/` (shared types and Radar helpers; no page of its own)
- additions to `shared/rules/calendar.json` (Purnima dates, weekday vows, Ramadan 2027)

## Provides
`Passport`, `RadarQuestion`, `service.rules_for / rules_on / plan_for / daylight_rules / cabin / rules_card / save / write_meal` (Python), endpoints in `shared/api.md` (`## m17`).

## Tasks
- [x] Spine: `Passport` table, `service.py`, seed (103 of 186 known), cabin and passport endpoints
- [x] `POST /api/passport` + `GET /api/passport/booking/{id}`: validated rules, labels stripped, the special meal through m3's `_save` (Profile, MealPromise, C1), Radar runs right after
- [x] `service.rules_on`: `confirm: true` date rules apply only on confirmed dates; declined dates never
- [x] Calendar Radar (`radar.py`): `POST /api/radar/scan`, `POST /api/radar/answer`; questions phrased from the public calendar; Yes before the cutoff reorders the meal, after it goes to m18's `submit_change`
- [x] `calendar.json`: `purnima` (Drik Panchang, New Delhi, Oct 2026 – Dec 2027) and `ramadan` (expected 2027 dates, moon-dependent)
- [x] Tests: `test_m17_flow.py`, `test_m17_passport.py`, `thread.test.ts`

## Done when
Priya saves her rules from the `/jal` special-meal form, gets AVML + NO ONION NO GARLIC, and the Radar asks about 25 Oct (Sharad Purnima); "Yes" switches her JL740 meal before the cutoff and shows in the change log.

## Notes
- 25 Oct 00:40: spine on main: `Passport` table, `service.py`, seed (103 of 186 passengers known: 23 from special meals or cast profiles, 80 from the T-48 h meal form; Priya, Mehta and Swati have none), `GET /api/passport/cabin/{flight_id}`, `GET /api/passport/{passenger_id}`.
- 25 Oct: save and Radar done. Checked on a fresh reset: Priya's rules → AVML + NO ONION NO GARLIC → Radar question "Your JL740 on Sun 25 Oct falls on Sharad Purnima" → Yes → 23C's promise is AVML + `NO ONION NO GARLIC NO ALCOHOL NO GRAIN NO LENTILS OR BEANS` (the order of the note comes from the rules engine).
- Nothing is inferred from a name: "Purnima", "Poonam" and "Ramzan" are first names and "Jain" a surname; the passport stores food rules and dates only.
- The change log entry needs m18: the Radar calls `app.modules.m18_changes.service.submit_change` when it is importable.
- Heads-up for m16: `/p/days` lists every observance in `calendar.json`, so it now shows Purnima and Ramadan too. Ramadan's `rules` is `dawn_to_sunset` (timing, not food); m16 may want to list only `rules == "vrat"`.
- The seed's Purnima passenger now fasts on 23 Dec (Drik Panchang), not 24 Dec.
- 25 Oct 08:30 (Bhavyam, team decision): diets come only from the special-meal form; the earlier free-text page and its endpoint are removed.
