# m6: late-request matcher

**Owner:** Gunagye (lane b) · **Branch:** `gunagye/m6-matcher` · **Phase:** 2, 19:00–22:30 IST
**Status:** done <!-- not started | in progress | blocked: <why> | done -->

## Goal
Act 4, our technical centrepiece. When someone asks for a meal at check-in, the gate, or as a judge joining live, the matcher checks **every meal already on board** against their rules. It picks a safe one in priority order:
1. spare special meal
2. veg option from the main menu
3. sealed backup
4. airside voucher

It explains why every alternative failed, reserves the meal, tells the crew at boarding, and messages the passenger. It also sizes the backups per flight.

## Owns
- `backend/app/modules/m6_matcher/`, `backend/tests/test_m6_*.py`
- `frontend/src/modules/m6-matcher/` (`MatchResult` component, the `/ops/late` desk page, `BackupForecast` panel)

## Uses (contracts it reads)
- **m1:** `evaluate()`, `label_mark()`.
- **m0:** core `MealItem`, `MealSpec`, `Passenger`, `MealPromise`, `Flight.backup_count`; `events.record_checkpoint` (LATE), `alerts.raise_alert` (LATE_REQUEST, info, addressed to crew), `outbox.notify`.
- **m3:** `DietPicker`, for the desk.

## Provides (what others rely on)
- **Endpoints:** `GET /api/flights/{id}/inventory`, `POST /api/match`, `POST /api/late-requests`, `GET /api/late-requests/{id}`, `GET /api/backups/forecast`. Shapes are in `shared/api.md`.
- **Python:** `match(flight_id, forbid, allow, passenger_id=None, source)`, used by m11's auto-fallbacks.
- **`MatchResult`** (`frontend/src/modules/m6-matcher/MatchResult.tsx`), used by m3 (judge join) and on `/ops/late`.
  - Props: `{result, lang?, compact?}`.
  - Shows the tier ladder, the chosen meal with its VerdictBadge, the "considered" list with fired rules, and solver info ("CP-SAT · 38 ms").
- **`BackupForecast`** panel, used by m7.

## Model
- **Candidates:** free items, meaning spares, backups, and main-menu meals above the count needed by passengers without special meals. **Keep the last 2 sealed backups in reserve** for galley contingencies (Act 5's missing tray). Use them for a late request only before falling back to a voucher.
- **Compatibility:** `evaluate(forbid, spec.tags) == SAFE`. NEEDS_HUMAN counts as not compatible, and the reason is shown.
- **CP-SAT objectives, in order:**
  1. Maximise covered passengers: the requester plus every existing strict promise keeps a safe meal.
  2. Minimise tier cost: spare 1 · main 3 · backup 5 · voucher 50.
  3. Minimise swaps of other passengers' meals.

  2 s time limit; greedy fallback (document it in `docs/plan/modules/m6-matcher.md` Notes, so m8 can copy it offline).
- **Voucher:** code, ₹600, airside outlets at DEL T3, labelled illustrative.
- **Backup forecast:** for each date, expected late strict-diet requests = base × weekday × festival (Diwali 8 Nov, Ekadashi dates, group bookings).
  - Recommended count = smallest n with Poisson CDF ≥ the critical ratio Cu / (Cu + Co).
  - Cu: a passenger left with nothing safe (complaints, ₹40k–65k court awards). Co: a sealed backup that flies again (12-month shelf life). That gives a ratio of about 0.95.
  - Show the method text.

## Tasks
- [x] **T1 Inventory + compatibility (30 min).** `GET inventory`, plus a compatibility matrix helper.

  _Done when:_ JL740 inventory lists specials, spares (VJML G2, AVML G1), 4 backups in G2, business spares and economy mains, with free counts.
- [x] **T2 CP-SAT + greedy + tests (45 min).**

  _Done when:_ tests pass for:
  - Mehta (Jain) → spare VJML G2
  - a second Jain → backup (and the third → voucher, because of the reserve)
  - vegan → vegan business spare, not the dairy backup
  - halal → none safe → voucher
- [x] **T3 Endpoints (30 min).** `/match` (dry run) and `/late-requests` (reserve: sets `assigned_passenger_id`, LATE event, LATE_REQUEST alert for crew, passenger notification "Your Jain meal is reserved: it'll be in galley 2"), plus `GET /late-requests/{id}`.

  _Done when:_ a reserve shows up in inventory as assigned and in `/api/notifications?to=<Mehta>`. **Ship.**
- [x] **T4 `MatchResult` + `/ops/late` desk (50 min).** Desk: search by seat/PNR/name → `DietPicker` (compact) → "Find a safe meal" (dry run) → `MatchResult` → "Reserve".

  _Done when:_ Act 4 runs from `/ops/late`. The considered list shows "AVML spare: contains onion", "Paneer butter masala: contains onion, garlic", "Chicken tikka masala: contains chicken". **Ship.**
- [x] **T5 Backup forecast (35 min).** `GET /api/backups/forecast?flight_no=JL740&days=14` and the `BackupForecast` panel (table + small chart with festival notes).

  _Done when:_ the panel shows 14 days with a visible bump in the days around Diwali.

## Done when
Act 4 and the judge-join meal search work live, every result explains itself, and m7 shows the backup panel.

## Notes
_Owner's running notes. Write the greedy algorithm here for m8._
- **Greedy fallback (m8: copy this offline).** Candidates are the free items: unassigned spares; unassigned main-menu meals while the cabin's main pool is above zero (pool = unassigned mains of that cabin's menu minus passengers in that cabin holding no item); unassigned sealed backups except the last 2 by galley position (reserve). Business-menu specs (`SPEC-C-…`) go only to business passengers. Keep the items whose spec is `evaluate(forbid, spec_tags(spec.tags, spec.certified)).verdict == "SAFE"` (NEEDS_HUMAN does not count). Pick the lowest tier cost (spare 1, main 3, backup 5), ties broken by galley position (`position` string order). Nothing left: voucher (₹600).
- **CP-SAT** adds swaps: a same-cabin passenger who holds a special meal that is safe for the requester may move to a free meal that is safe for them (their profile's `forbid`). A swap costs as much as a backup, so it only wins when it avoids a voucher. One weighted objective: uncovered 10^9, tier cost 10^6, swaps 10^4, galley position as tie-break; 2 s limit, 1 worker (repeatable answers). Any solver error falls back to greedy.
- **Spec test changes, decided by the rules:** halal → the AVML spare (vegetarian, nothing halal forbids), not a voucher; uncertified chicken shows NEEDS_HUMAN. Jains after Mehta: #2 and #3 get the 2 usable backups, #4 gets a voucher (the last 2 backups stay in reserve for Act 5).
- **Extra fields** (additive): inventory items carry `tier, cabin, free, reserve`; summary has `main_free {C, Y}` and `backup_reserve`. MatchResult has `label_mark`, `source`; each `considered` row has `galley`, `note` (why it can't be used even if safe) and `chosen`. Vouchers carry `illustrative: true`.
- **Desk diet input** is `DietChoice.tsx` (presets only), a stand-in until m3 ships `DietPicker`; same `{presets, forbid, allow}` value.
- **`MatchResult`** is exported from `@/modules/m6-matcher` (props `{result, lang?, compact?}`; `compact` hides the considered list).
- **Backup forecast** (`forecast.py`): Poisson λ = 0.5 × weekday × festival/group factor (Diwali 8 Nov 2026 with travel days, an approximate Ekadashi, the 25 Oct group); load = Poisson quantile at Cu/(Cu+Co) = 50,000/52,600 ≈ 0.95, plus the 2 galley-reserve backups. Normal days give 4 (today's load), Diwali days 5. Response adds `late_cover`, `galley_reserve`, `flight_no`. `BackupForecast` is exported from `@/modules/m6-matcher` for m7 (props `{flightNo?, days?, lang?}`).
- **Late request writes:** item `assigned_passenger_id`, a `LateRequest` row (keeps `forbid/allow`, so m8 can check a late passenger with no profile), LATE checkpoint (`key: late:<id>`), LATE_REQUEST alert (info), a crew notification to `crew:JL740` and an SMS to the passenger. Asking again returns the same reservation.
