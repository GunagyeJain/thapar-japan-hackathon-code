# m4: lost-meal watcher

**Owner:** Bhavyam · **Branch:** `bhavyam/m4-watcher` · **Phase:** 1, 17:00–19:30 IST. T1–T2 parsing can start earlier, in new files only (see PLAN.md).
**Status:** in progress <!-- not started | in progress | blocked: <why> | done -->

## Goal
Act 2, the heart of the pilot. ThaliBento reads **copies of the passenger-list messages** (PNL, then ADLs) that the airline already sends to the airport and the caterer. It notices that a rebooking from an IndiGo codeshare silently dropped Priya's AVML, and raises a LOST_MEAL alert with the evidence and the time left before the caterer's final list. Staff approve "request again"; a corrected ADL arrives; checkpoint C2 turns green. Read-only: we never write into the booking system.

## Owns
- `backend/app/modules/m4_watcher/` (parser, renderer, reconciler, simulator, router, `seed.py`)
- `shared/seed/messages/` (PNL and ADL fixtures)
- `backend/tests/test_m4_*.py`

## Uses (contracts it reads)
- **m0:** core `Flight`, `Passenger`, `MealPromise`, `RawMessage`; `events.record_checkpoint`, `alerts.raise_alert`, `outbox.notify`; `clock.now()`.
- **m1:** `check_booking(forbid, code)` from `app.modules.m1_rules.engine`. **Until m1 ships (~18:00)**, mock it in `mock.py`: "HNML is not OK when `forbid` contains meat".

## Provides (what others rely on)
- **Endpoints** (shapes in `shared/api.md`): `POST /api/feed/messages`, `GET /api/flights/{id}/messages`, `GET /api/flights/{id}/manifest`, `GET /api/alerts`, `POST /api/alerts/{id}/actions`, `POST /api/sim/booking-events`.
- **Python for m11:** `ingest(text)` and `simulate(event_type, passenger_id=None, **params)`.
- C2 checkpoint events; LOST_MEAL, WRONG_CODE and DELAY_HOLD alerts; passenger notifications.

## Message format (our subset of the IATA PNL/ADL layout; lines ≤ 64 characters)
```
PNL
JL740/25OCT DEL PART1
CFG/030C156Y
-NRT030C
1JAIN/SUSHILAMRS .L/4QZ8NW
.R/VJML HK1 DIABETIC
.R/SEAT HK1 02A
-NRT156Y
1SHARMA/PRIYAMS .L/6XK2QP
.R/AVML HK1 NO ONION NO GARLIC
.R/SEAT HK1 23C
.I/6E5318Y24BOMDEL
ENDPNL
```
```
ADL
JL740/25OCT DEL PART1
-NRT156Y
DEL
1SHARMA/PRIYAMS .L/6XK2QP
ADD
1SHARMA/PRIYAMS .L/8MZ2TN
.R/SEAT HK1 23C
.I/6E5102Y24BOMDEL
ENDADL
```
How to read it:
- A **name line** is `1SURNAME/GIVENTITLE`, with the title stuck on the end: MR, MRS, MS, MSTR, MISS or DR. `.L/` is the booking reference (PNR).
- **Remarks:** `.R/<code> HK1 <free text>` is a meal SSR (code from `shared/rules/codes.json`); `.R/SEAT HK1 <seat>` is the seat; `.R/GRP <name>` is a group.
- **`.I/`** is the inbound connection: flight, class, day, from, to.
- **ADL sections:** `ADD`, `DEL` and `CHG` sit under the class header. `CHG` repeats a name with its new elements.

## Reconcile (runs after every ingest)
1. **Apply changes to Passenger rows.** A `DEL` and an `ADD` with the same surname, given name and title in one ADL is a **rebooking**: keep the same Passenger id and update `pnr`, `inbound`, `ssr_meal` and `ssr_note`.
2. **Check every MealPromise on the flight:**
   - Booking has **no meal SSR** → C2 `fail` and a **LOST_MEAL** alert:
     - critical, `deadline_at = flight.caterer_final_list_at`
     - title "Meal request dropped after rebooking"
     - evidence: message ids, the line before, the line after, old PNR, new PNR, inbound before and after
   - Booked code **breaks the rules** (`check_booking`) → **WRONG_CODE** (warning).
   - Code **matches** → C2 `ok`, or `fixed` if it was failing. In that case also resolve the open alert and notify the passenger: "Your veg meal (no onion, no garlic) is back on JL740."

## Tasks
- [ ] **T1 PNL render + parse (40 min).** `render_pnl(flight)` builds the PNL from the database, in the format above; save it as `shared/seed/messages/pnl_jl740.txt`. `parse(text)` returns ManifestRows.

  _Done when:_ a test proves `parse(render_pnl())` matches all 186 seeded passengers (seat, PNR, SSR, inbound).
- [ ] **T2 ADL parse + apply (40 min).** ADD / DEL / CHG plus rebooking detection. Fixtures in `shared/seed/messages/`:
  - `adl_rebook_23C.txt` (above)
  - `adl_restore_23C.txt`: `CHG` `1SHARMA/PRIYAMS .L/8MZ2TN` + `.R/AVML HK1 NO ONION NO GARLIC`
  - `adl_seat_change.txt`

  _Done when:_ tests prove Priya keeps one Passenger id with the PNR 6XK2QP → 8MZ2TN and her meal goes AVML → none → AVML.
- [ ] **T3 Reconcile + alerts + read endpoints (40 min).** Implement reconcile; then `POST /api/feed/messages`, `GET messages`, `GET manifest`, `GET /api/alerts`.

  _Done when:_ posting `adl_rebook_23C.txt` creates exactly one LOST_MEAL for 23C with deadline 25 Oct 00:40 IST and a C2 `fail` event. **Ship** (heads-up: "alerts API live").
- [ ] **T4 Actions + simulator + seed (40 min).**
  - `POST /api/alerts/{id}/actions`. Each action appends `{action, actor, at: clock.now(), note}`. `request_again` stores `evidence.ssr_draft = "SSR AVML JL HK1 DELNRT0740Y25OCT-1SHARMA/PRIYAMS.NO ONION NO GARLIC"`, then runs `simulate("restore_meal", …)`. `notify_passenger` and `notify_kitchen` go through `outbox.notify`.
  - `POST /api/sim/booking-events` supports `rebook_drop_meal`, `restore_meal` and `seat_change`. `delay` (sets `flight.delay_min`, raises DELAY_HOLD, notifies "caterer") is stretch.
  - `seed()` stores the PNL as message 1 and runs reconcile, so WRONG_CODE appears for 24A (HNML vegetarian).

  _Done when:_ simulate rebook → LOST_MEAL; `request_again` → corrected ADL ingested, C2 `fixed`, alert resolved with 2 audit entries, and a notification exists for Priya. **Ship.**

## Done when
Act 2 runs from the API alone: rebook → alert with evidence and deadline → request again → fixed. m5 shows it in the ops console.

## Notes
_Owner's running notes._
- 24 Oct: `parser.py` (parse PNL/ADL, `render_pnl`) and the rebook/restore ADL fixtures are in, with tests. Waiting on m0 for: `pnl_jl740.txt` and the 186-passenger round-trip test (need the seed), `adl_seat_change.txt` (needs a seeded PNR), apply/rebooking detection (needs Passenger rows).
