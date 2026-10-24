# m10: insights

**Owner:** Bhavyam · **Branch:** `bhavyam/m10-insights` · **Phase:** 3, 22:30–00:30 IST
**Status:** done <!-- not started | in progress | blocked: <why> | done -->

### Where it stands (24 Oct, 18:29 IST)
- **Done and on main:** `GET /api/promises/{id}/timeline` and the `/insights` page. T2 (shadow month) is cut.
- **Checked on the real story** (`/demo` steps 0 to 8): Priya (23C) shows C1 ok, C2 fail at 23:02 (source "ADL 2") then fixed at 23:09 ("ADL 3"), C3, C4 and C5 ok, 5/5 passed. Breakpoint callout: caught 1 h 38 m before the caterer's list, fixed in 7 min by request again. Checked at 1440 px in English, Hindi and Japanese.
- **One click from `/demo`:** step 8 opens `/insights`, which starts on 23C. `?seat=24A` (or a row click) switches passenger.
- **Bhavyam next:** m13 (T5 Q&A sheet, then the T3 deck outline).

## Goal
Act 6: proof the promise was kept, and where it nearly broke. Priya's C1–C5 timeline shows the **breakpoint** (C2: codeshare rebooking at 23:02), when it was fixed, and by whom. That's the failure data JAL doesn't have today. If time allows, a simulated "shadow month" dashboard shows what pilot month 1 would measure.

## Owns
- `frontend/src/modules/m10-insights/` (page `/insights`, `i18n.ts`, `mock.ts`)
- `backend/app/modules/m10_insights/`, `backend/tests/test_m10_*.py`
- `shared/seed/history/` (shadow month data, stretch)

## Uses (contracts it reads)
- **m0:** core `CheckpointEvent`, `MealPromise`, `Passenger`, `Alert`.
- **m2:** `Timeline`, `KpiTile`, `DataTable`, `PageHeader`, `EmptyState`. Recharts for charts (`docs/design.md`).

## Provides (what others rely on)
- **Endpoints:** `GET /api/promises/{id}/timeline` and `GET /api/insights/summary`. Shapes are in `shared/api.md`.
- The `/insights` page (m11's story points here for Act 6).

## Rules
- **Timeline:** every CheckpointEvent for the promise, ordered by `at`, plus that passenger's alert actions.
- **`breakpoint`:** the first event with `result: "fail"`. If a later event for the same checkpoint has `result: "fixed"`, show "fixed at 23:09 by Ground staff · DEL (request again)".

## Tasks
- [x] **T1 Timeline endpoint + page (50 min).** `/insights` opens on Priya's promise; a seat/name picker switches passengers. It shows the `Timeline` (C1 → C5 with icons, times in IST/JST, source lines such as "ADL 2 · 23:02"), a breakpoint callout, and a "what JAL learns" line.

  _Done when:_ after running Acts 1–5 (or posting the m4 fixtures), Priya's timeline shows C1 ok, C2 fail → fixed, C3 ok, C4 ok, C5 ok, with the breakpoint marked.
- [ ] **T2 Shadow month (stretch, 50 min). Cut.** A generator writes `shared/seed/history/shadow_month.json`: 30 days of JL740 with promises, failures by checkpoint, caught before the deadline, verified in the galley, and late requests by diet. It's clearly labelled "simulated: what pilot month 1 measures". Then `GET /api/insights/summary?days=30` and a dashboard (KPI tiles, failures by checkpoint, daily trend).

  _Done when:_ the dashboard renders from the summary endpoint at 1440 px.

## Done when
Act 6's timeline is on screen in one click from `/demo`, and it's readable on the projector.

## Notes
_Owner's running notes._
