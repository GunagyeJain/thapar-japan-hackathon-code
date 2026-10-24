# m7: caterer portal + labels

**Owner:** Gunagye (lane b, taken over from Shefali) · **Branch:** `gunagye/m7-caterer` · **Phase:** 2, 19:30–22:30 IST
**Status:** done <!-- not started | in progress | blocked: <why> | done -->

## Goal
Act 3. The kitchen gets every meal list as a **numbered, timestamped, hashed version** with a diff from the last one, and acknowledges it. That acknowledgement is checkpoint C3, and fair proof if there's ever a dispute. It prints **labels that are hard to misread**: a big diet mark, name, booking ref, flight, and an opaque QR. Seats aren't printed, because they change after the truck leaves; the crew tablet looks the seat up live.

## Owns
- `frontend/src/modules/m7-caterer/` (pages `/caterer` and `/caterer/labels`, `i18n.ts`, `mock.ts`)
- `backend/app/modules/m7_caterer/` (`MealListVersion` model, service, router, `seed.py`), `backend/tests/test_m7_*.py`

## Uses (contracts it reads)
- **m0:** core `Flight` (incl. `backup_count`), `Passenger` (current booking state, kept up to date by m4), `MealPromise`, `MealItem`, `MealSpec`; `events.record_checkpoint` (C3); `GET /api/notifications?to=caterer`.
- **m1 (Python):** `label_mark(forbid, allow)` for the diet mark. Until it ships, use `promise.label_mark`, or the code name for passengers without a promise.
- **m6:** the `BackupForecast` panel component (from ~22:00). Until then, show `Flight.backup_count` with the line "4 sealed safe-backup meals (fixed for the pilot)".
- **m2:** `@/ui` components and `docs/design.md`.

## Provides (what others rely on)
- **Endpoints:** `GET /api/flights/{id}/meal-lists`, `POST /api/flights/{id}/meal-lists`, `POST /api/meal-lists/{id}/ack`, `GET /api/flights/{id}/labels`. Shapes are in `shared/api.md`.
- **Python for m11:** `cut_version(flight_id)` and `ack(version_id, by)`.

## Rules
- **Lines** = every passenger whose booking has a meal SSR, joined with their assigned `special` MealItem. Sort by code, then name.
- **`sha256`** = hash of the canonical JSON of the lines (sorted keys, no spaces). Show the first 12 characters.
- **Diff** vs. the previous version, by `passenger_id`: added / removed / changed (e.g. booking ref 6XK2QP → 8MZ2TN).
- **Seed:** v1 at 24 Oct 03:35 (the T-25 h cutoff), v2 at 24 Oct 22:40.
- **QR payload** is the bare item id (`TB-7K2Q9F`), never a URL.

## Screens
- **`/caterer`:**
  - flight header
  - version list: v1, v2, v3…, each with its time (IST), short hash and ack state
  - the selected version as a DataTable grouped by code, with counts per code
  - a diff panel
  - **Acknowledge** ("Skyline Flight Kitchens · shift lead")
  - inbox (notifications to the caterer: delay alerts, new versions)
  - the backup panel
- **`/caterer/labels`:**
  - A4 sheet with 8 labels (2 × 4, about 99 × 67 mm)
  - big diet mark in English (Archivo, ~28 pt) with a Japanese line under it
  - name, PNR, flight + date, code + note, QR and item id
  - a Print button; `@media print` hides the app chrome

## Tasks
- [x] **T1 Backend (45 min).** Model, `cut_version`, diff, sha256, `ack` (writes C3 for every promise on the list), labels endpoint, seed v1 + v2, tests.

  _Done when:_ after m4's rebooking fixture plus "request again", `POST /api/flights/JL740-20261025/meal-lists` returns v3, whose diff shows Priya's line changed (6XK2QP → 8MZ2TN, AVML kept), and ack writes C3.
- [x] **T2 Versions page (45 min).** Versions list, grouped table, diff panel, acknowledge, inbox.

  _Done when:_ v1 → v3 is browsable, the hash and timestamps are visible, and ack flips the state live.
- [x] **T3 Label sheet (45 min).** Print layout plus QR (`qrcode` package).

  _Done when:_ Chrome print preview shows 8 labels per A4, and a phone camera scanning a printed QR reads `TB-…`.
- [x] **T4 Backup panel + states (25 min).** Swap in m6's `BackupForecast` when it's on main; loading, empty and error states.

  _Done when:_ the `docs/design.md` checklist passes at 1440 px.

## Done when
Act 3 runs live: v3 appears with its diff, gets acknowledged, and its labels print and scan.

## Notes
_Owner's running notes: what's mocked, open questions._
- **Taken over by lane B at 17:00** (see docs/decisions.md); nothing had been started on `shefali/m7-caterer`.
- **Python:** `app.modules.m7_caterer.service.cut_version(flight_id)` and `ack(version_id, by)` (both take an optional `session=`). Cutting when nothing changed returns the latest version instead of a duplicate.
- **Diff** adds `changed: [{passenger_id, name, fields: [{field, before, after}], before, after}]` next to `added` / `removed`. Versions also carry `short_hash` (first 12 of sha256).
- **Seed:** v1 at 24 Oct 03:35 (acked 04:06) and v2 at 22:40 (acked 22:51), both by "Skyline Flight Kitchens · shift lead". v2's one change: the agent added the note DIABETIC to 2A's VJML after the cutoff. Seed acks write no C3; C3 comes from acknowledging v3 in Act 3.
- **Labels:** mark from the promise's `label_mark`, else from what the booked code and note exclude (m1 `label_mark`). Each label also has `version`.
- m11's stand-in for the acknowledgement switched off by itself now that these routes exist.
- **Label marks** come from the passenger's profile through m1 `label_mark` (so 24A booked on HNML still prints VEG; WRONG_CODE flags the booking). No profile: the booked code's diet families plus the note (AVML → VEG, MOML → HALAL, HNML → no beef, no pork). Long marks step down from 28 pt so the QR keeps its room.
- **QR** uses `uqr` (already a frontend dependency for /demo) instead of the `qrcode` package the spec named. All 24 label QRs on v3 decode back to their item id (checked with OpenCV at print resolution); a phone-camera scan of a printed sheet still needs a person.
- **Print:** `@page A4, margin 0`; only `.label-sheets` print, one sheet per page (3 pages for v3's 24 meals).
- `/caterer` shows m6's `BackupForecast` under the lists.
