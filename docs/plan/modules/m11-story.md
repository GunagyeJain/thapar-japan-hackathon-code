# m11: story engine + demo control

**Owner:** Gunagye (lane b) · **Branch:** `gunagye/m11-story` · **Phase:** 3, 22:00–02:00 IST
**Status:** done <!-- not started | in progress | blocked: <why> | done -->

## Goal
Make the 4-minute demo deterministic and impossible to get lost in. `/demo` is the presenter's control panel:
- it steps the sim clock through the six acts
- it tells the presenter what to click next and on which screen
- it can perform any step itself if a live click fails
- it shows the QR that invites judges to join

A Playwright run proves the whole story still works before every rehearsal.

## Owns
- `frontend/src/modules/m11-demo/` (page `/demo`)
- `backend/app/modules/m11_story/`, `backend/tests/test_m11_*.py`
- `e2e/` (Playwright), `scripts/demo.sh`

## Uses (contracts it reads)
- **m0:** `POST /api/clock`, `POST /api/demo/reset` (incl. `keep_judges`), `seed_epoch`.
- **Auto-fallbacks call each owner's service:**
  - m3 `create_profile` (Priya's form)
  - m4 `simulate` + the `request_again` action
  - m7 `cut_version` + `ack`
  - m6 `match` + reserve (Mehta)
  - m8 crew events (galley found/missing, swap, scans)

## Provides (what others rely on)
- **Endpoints:** `GET /api/demo/scenario`, `POST /api/demo/step`.
- The `/demo` page and `e2e/story.spec.ts`.

## Steps
| n | Sim time (IST) | Auto | Presenter does (cue) |
|---|---|---|---|
| 0 | 23 Oct 18:00 | reset, keeping judges | boarding-pass hook on `/demo`; **invite the judges now** (QR) |
| 1 | 23 Oct 18:10 | (fallback: create Priya's profile) | phone `/p`: Priya's form → AVML + note; `/ops` shows WRONG_CODE 24A |
| 2 | 24 Oct 23:02 | `simulate rebook_drop_meal` for 23C | `/ops`: LOST_MEAL alert, evidence, countdown 1 h 38 m |
| 3 | 24 Oct 23:09 | (fallback: request_again) | `/ops/alerts/:id` → Request again → C2 fixed |
| 4 | 25 Oct 00:40 | `cut_version` → v3 | `/caterer`: diff + Acknowledge → labels |
| 5 | 25 Oct 02:50 | (fallback: reserve for 31K) | `/ops/late`: Mehta, Jain → spare VJML G2 |
| 6 | 25 Oct 03:35 | crew package refresh | `/crew`: download for flight, boarding alerts, judges' seats |
| 7 | 25 Oct 05:20 | (fallback: crew events) | tablet offline: galley check 7/8, backup for 27D, scans at 23C |
| 8 | 25 Oct 15:20 JST | – | `/insights`: Priya's timeline + backups |

Every step is idempotent: running it twice changes nothing.

## Tasks
- [x] **T1 Scenario + step runner (45 min).** Step definitions, `GET /scenario`, `POST /step` (sets the clock, runs the auto actions, marks done), tests.

  _Done when:_ stepping 0 → 8 by API alone ends with Priya's C1–C5 all green and 27D served from the backup.
- [x] **T2 `/demo` page (40 min).**
  - Step list with the current step, a big cue card ("Now: open Ops → click Request again"), Next / Back, and "Do it for me".
  - Reset (keep judges / full), with a confirm.
  - The judge QR built from the page's **current** address (`location.origin + "/j"`), and a live count of judges who joined.

  _Done when:_ the whole story can be presented from `/demo` plus the four surfaces.
- [x] **T3 Playwright smoke (40 min).** `e2e/story.spec.ts`: reset, then step through, checking the key text on each screen (alert title, "AVML", "v3", "VJML", "7 of 8", the timeline breakpoint).

  _Done when:_ `npx playwright test` passes against `npm run demo`.
- [x] **T4 Demo script (15 min).** `scripts/demo.sh`: build, start, print the local and tunnel instructions.

  _Done when:_ one command gets from a clean checkout to a running demo.

## Done when
Two dry runs in a row work from `/demo` with no manual database fiddling, and the Playwright smoke passes.

## Notes
- Judges join during Act 0/1, while the tablet is still online. Their seats sync to the tablet with the package at step 6.
- On the projector, judges show as first name + initial; their diet comes from presets only.
- **How steps call the other modules:** through their HTTP routes in `shared/api.md`, in-process (`actions._call`), not Python imports, so an owner can structure their code freely. m3 `POST /profiles`, m4 `POST /sim/booking-events` and `POST /alerts/{id}/actions`, m7 `GET/POST /flights/{id}/meal-lists` + `POST /meal-lists/{id}/ack`, m6 `POST /late-requests`, m8 `POST /flights/{id}/crew-events`.
- **Stand-ins until a route is on main** (404/405): m4's rebooking (Priya 6XK2QP → 8MZ2TN, SSR dropped, C2 fail, LOST_MEAL with the deadline) and request-again (SSR back, C2 fixed, alert resolved, SMS); m7's acknowledgement (C3 for every promise). They switch off by themselves once the routes exist.
- **Step 7** sends the tablet's events with fixed `client_id`s (`story-<type>-<item>-<who>`), so a second sync is all duplicates. 27D gets the first galley-reserve backup.
- **Step 0** resets (keeping judges) unless nothing has happened since the last story reset, so judges who joined meanwhile stay.
- **Smoke** (`e2e/story.spec.ts`, `npm run e2e`): 7 acts, API steps with auto, UI checks on /demo, /p, /ops/late (the real desk flow) and /crew ("7 of 8 found"). Screens still on their placeholder (/ops, /caterer, /insights today) are noted as pending and checked by API only; their UI checks switch on by themselves once they ship. Passed twice in a row on 24 Oct 16:55.
- **m4 and m7 are on main (18:19):** every step now runs on the owners' real routes; the stand-ins don't fire. Smoke 7/7 twice on main.
- **When m4 and m7 ship:** their real routes replace the stand-ins automatically; re-run `npm run e2e` (and step through `/demo` once) to confirm the story still ends green.
- `POST /demo/step` also returns `did: string[]` (what the server just did), shown on `/demo`.
- 25 Oct (v2): `/demo` runs the v2 story in six steps (`steps.py`): 0 the cutoff ladder, 1 Priya's passport on `/jal`, 2 the Calendar Radar's question (Yes), 3 Chaos Mode on `/ops/changes`, 4 the crew copilot on `/crew`, 5 the numbers. Actions call the m17 and m18 routes in-process like the v1 ones. The v1 beats stay in `actions.py` (Chaos Mode reuses the rebooking and request-again beats) and `backend/tests/story_v1.py` runs them for the m3, m7 and m10 tests. `e2e/story.spec.ts` is the v2 smoke.
