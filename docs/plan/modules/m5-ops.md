# m5: ops console

**Owner:** Bhavyam · **Branch:** `bhavyam/m5-ops` · **Phase:** 2, 19:30–22:30 IST
**Status:** not started <!-- not started | in progress | blocked: <why> | done -->

## Goal
The screen ground staff at Delhi watch overnight; it's on the projector in Act 2. It shows a flight board with live deadlines and an alert queue, and each alert opens with its **evidence**: the raw PNL and ADL lines, a before/after diff, the SSR draft. A clear "Request again" step makes it obvious a human approves every fix.

## Owns
- `frontend/src/modules/m5-ops/` (pages `/ops` and `/ops/alerts/:id`, `i18n.ts`, `mock.ts`)

`/ops/late` (the late-request desk) belongs to m6, but sits in the same ops nav.

## Uses (contracts it reads)
- **m4:** `GET /api/alerts`, `GET /api/flights/{id}/messages`, `GET /api/flights/{id}/manifest`, `POST /api/alerts/{id}/actions`. **Until m4 ships (~19:00), use `mock.ts`** with two alerts in the exact `Alert` shape from `shared/README.md`:
  - LOST_MEAL for 23C: deadline 00:40, evidence with the before/after lines from `docs/plan/modules/m4-watcher.md`
  - WRONG_CODE for 24A
- **m0:** `GET /api/flights/{id}`, `/api/flights/{id}/passengers?with_promises=true`, `/api/notifications`, `useSimClock()`.
- **m2:** `PageHeader`, `FlightContextBar`, `KpiTile`, `DataTable`, `StatusChip`, `Countdown`, `RawMessage`, `DiffView`, `Timeline`, `EmptyState` from `@/ui`, plus `docs/design.md`.

## Provides (what others rely on)
- The `/ops` pages (m11's story points the presenter here for Acts 1, 2 and 4)

## Screens
- **`/ops`:**
  - FlightContextBar: JL740 · DEL 04:35 → NRT 15:20 JST · sim clock IST/JST · "Caterer list in 1 h 38 m".
  - KPI row: passengers, special meals, meal promises, open alerts, "lost meals caught before deadline".
  - Alert queue (DataTable, polling every 2 s), sorted by deadline. Columns: severity chip, type, seat, passenger, title, deadline countdown, status.
  - Right panel: latest messages from the feed (kind, time, line count).
- **`/ops/alerts/:id`:**
  - Header: title, seat, passenger, PNR (old → new), countdown.
  - Evidence: `RawMessage` showing the PNL lines for the passenger (highlighted) and the ADL that changed them, plus a `DiffView` of the before/after booking lines ("AVML HK1 NO ONION NO GARLIC" → nothing).
  - Actions:
    - **Request again** opens a dialog showing `evidence.ssr_draft` and "A staff member approves every fix. Nothing in the booking system changes on its own." → confirm.
    - **Notify passenger** (preview the SMS in English and Hindi).
    - **Acknowledge**, **Resolve**.
  - `Timeline` of the audit trail (`alert.actions`) and the C2 result.

## Tasks
- [ ] **T1 Board + queue (45 min).** Context bar, KPI row, alert queue against `mock.ts`, switched to the real API with one flag when m4 ships.

  _Done when:_ `/ops` shows both alerts with live countdowns at 1440 px, and new alerts appear within 2 s without a full-page flash.
- [ ] **T2 Alert detail + request again (50 min).** Evidence panel, actions with the confirm dialog, audit timeline.

  _Done when:_ against the real API, `POST /api/sim/booking-events {type: "rebook_drop_meal", passenger_id: <Priya>}` shows the LOST_MEAL alert; "Request again" ends with the alert resolved, C2 fixed, and the passenger notification listed.
- [ ] **T3 Feed + states (30 min).** A raw message list (click to view the full text), plus loading, empty and error states per `docs/design.md`. A "Notify kitchen" button on DELAY_HOLD alerts if m4 shipped them.

  _Done when:_ the design checklist in `docs/design.md` passes at 1440 px and on the projector (1920 × 1080).

## Done when
Act 2 can be run from `/ops` by the presenter in under a minute, with the evidence readable from the back of the room.

## Notes
_Owner's running notes: what's mocked, open questions._
