# m16: diets that change by date

**Owner:** Gunagye (lane b) · **Branch:** `gunagye/m16-days` · **Phase:** late add, 22:00–01:30 IST (on main by 01:30; freeze 02:00)
**Status:** not started <!-- not started | in progress | blocked: <why> | done -->

## Goal
Many Indian diets change with the calendar. On Ekadashi (twice a month) or during Navratri, people who fast skip grains, lentils, onion and garlic but eat fruit, potato, peanuts and dairy. On every other day they eat their usual meal. A 4-letter meal code can't say "only on 20 Nov", so today this lives in someone's memory, or the passenger skips the meal.

m16 makes the rules date-aware:
- The passenger taps the fasts they keep on their phone. The phone holds a public fast-day calendar, works out which of **their own flight dates** are fast days, shows them, and lets them confirm or move a date (panchangs differ by a day between regions).
- Only those dates leave the phone. The server never learns "Ekadashi" or a religion, only "on 20 Nov this passenger also avoids grains" (same promise as Q&A Q5).
- On a fast-day leg, the fasting rules (m1's `vrat` preset) are added to the person's everyday rules and that leg gets its own code and kitchen note. Other legs are unchanged. A leg catered in Tokyo also gets the note in Japanese for the caterer.
- Ops sees the coming fast-day legs before each caterer cutoff.

Demo moment: Priya's return flight JL749 Tokyo → Delhi on 20 Nov 2026 is Prabodhini Ekadashi in most panchangs. Her outbound meal stays AVML + "NO ONION NO GARLIC"; her return meal becomes AVML + "NO GRAIN NO LENTILS OR BEANS NO ONION NO GARLIC", and the Tokyo kitchen gets the same note in Japanese.

## Owns
- `shared/rules/calendar.json` (m1's folder; lane B owns both)
- `backend/app/modules/m16_days/` (router, `TripLeg` table, seed), `backend/tests/test_m16_*.py`
- `frontend/src/modules/m16-days/` (pages `/p/days`, `/ops/days`, `i18n.ts`)
- Additions in m1 (`engine.py`, `@/lib/rules`, vectors) and one nav line in `frontend/src/app/nav.ts` (shared zone, add-only)

## Uses (contracts it reads)
- **m1:** `presets.json` (`vrat`), `combine_presets`, `code_options`, taxonomy `labels.ja` for the Japanese note.
- **m3:** `GET /api/passenger/lookup`, the passenger's `Profile.forbid`/`allow`; `POST /api/passenger/meal-options` rule (never empty: SPML + note when no code fits).
- **m0:** core `Passenger`, `Profile.fasting_dates` (already in the contract), the sim clock.
- **m2:** `@/ui` components only.

## Provides (what others rely on)
- **Rules:** `engine.rules_on(forbid, allow, fasting_dates, date) -> {forbid, allow, fast_day}` in Python and `rulesOn()` in `@/lib/rules`, with shared vectors. `calendar.json`: `{source, note, observances: [{id, labels: Text, rules: "vrat", dates: [iso]}]}` (Ekadashi and Navratri, 25 Oct 2026 → 31 Oct 2027).
- **Endpoints** (rows go into `shared/api.md` under `## m16 · diets that change by date`):
  - `GET /api/days/trips?passenger_id=` → `{legs: Leg[]}`, the passenger's legs with the meal for each.
  - `POST /api/days/save` `{passenger_id, fast_dates: iso[]}` → `{legs: Leg[]}`. Stores which legs are fast days (only dates on the person's own legs are accepted; 422 otherwise).
  - `GET /api/days/ahead?days=30` → `{legs: (Leg & {passenger_id, name, seat})[]}`, fast-day legs only, soonest first, for ops.
  - `Leg = {flight_no, date, from, to, catered_in, fast_day, code, kitchen_note, kitchen_note_ja, label_mark: Text, usual: {code, kitchen_note}}`
- **Story:** `docs/demo-script.md` gets the `/p/days` moment (Act 6, or Act 1 if it fits the 4 minutes).

## Tasks
- [ ] **T1 Calendar + date-aware rules (40 min).** `calendar.json` with dates from one named panchang for New Delhi (source URL in the file, "your family's date may differ by a day" in `note`). `rules_on` adds the `vrat` preset's forbid and allow on a fast day (forbid wins over allow, as in `combine_presets`). TS mirror. Vectors: Priya on 25 Oct (not a fast day) and 20 Nov (fast day), a Jain on a fast day.

  _Done when:_ pytest and vitest agree on the new vectors.
- [ ] **T2 Trips + endpoints (45 min).** Module table `TripLeg` with a seed: Priya PX-0057 (JL740 DEL→NRT 25 Oct, caterer DEL; JL749 NRT→DEL 20 Nov, caterer NRT) plus 4 cast passengers with legs in the next 30 days. The three endpoints above; the Japanese note from taxonomy `labels.ja`. If time: m6's backup forecast reads festival dates from `calendar.json` instead of its own approximate table.

  _Done when:_ `GET /api/days/trips?passenger_id=PX-0057` returns two legs, and after saving 20 Nov the return leg reads AVML + `NO GRAIN NO LENTILS OR BEANS NO ONION NO GARLIC` with a Japanese note.
- [ ] **T3 Screens (60 min).** `/p/days` (mobile, EN/HI/JA): "Do you keep any fasts?" chips (Ekadashi, Navratri; the choice stays on the phone), then each leg as a boarding-pass row with its date and meal, the fast-day leg highlighted with "Is 20 Nov right for you?" (move ±1 day), **Save**. `/ops/days` (desktop): the ahead list with usual vs. on-the-day meal and the caterer cutoff. Nav line for `/ops/days`. Run the design.md checklist.

  _Done when:_ both screens work at 390 px and 1440 px, with real seed data and no new colours.
- [ ] **T4 Story + ship (25 min).** Demo-script lines for the moment and its fallback, `shared/api.md` rows, Notes, `npm run e2e` 7/7, ship.

  _Done when:_ on main by 01:30 and the smoke is green.

## Done when
On main by 01:30: Priya can tell her phone she keeps Ekadashi, see that her 20 Nov return flight is a fast day, confirm it, and see that leg's meal and kitchen note change (in Japanese for Tokyo) while her outbound meal stays the same. Ops sees the leg in the fast-days list. The server stores dates and rules only.

## Notes
_Owner's running notes._
- 24 Oct 21:40, planned after the team decided the pitch needs two more new things (see `docs/decisions.md`).
- Not built (slide only): Ramadan timing (iftar after sunset, suhoor before a pre-dawn departure, expected 9 Feb to 10 Mar 2027), and Paryushan's stricter Jain days.
