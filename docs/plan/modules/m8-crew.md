# m8: crew tablet (offline)

**Owner:** Gunagye (lane a) · **Branch:** `gunagye/m8-crew` · **Phase:** 2, 18:00–23:30 IST
**Status:** in progress <!-- not started | in progress | blocked: <why> | done -->

## Goal
Act 5, the moment people remember. It's built as an extra screen for the crew iPad app JAL already uses (i-PAXINFO), in dark cabin mode, Japanese first with English underneath. Before departure it downloads the flight package; then in **airplane mode** it still runs:
- **Galley check:** "7 of 8 found"; 27D's Jain meal is missing → "use the backup veg meal from galley 2", scan it, green.
- **Seat scan:** scanning the wrong tray at 23C shows red, "contains onion".

Everything syncs when the connection comes back.

## Owns
- `frontend/src/modules/m8-crew/`, `frontend/src/lib/offline/`, `frontend/public/crew/` (icons, manifest)
- `backend/app/modules/m8_crew/`, `backend/tests/test_m8_*.py`
- The PWA lines in `frontend/vite.config.ts` (shared zone, add-only)

## Uses (contracts it reads)
- **m0:** core entities, `seed_epoch`, `events.record_checkpoint` (C4, C5), `alerts.raise_alert` (MISSING_TRAY, RED_SCAN).
- **m1:** server verdicts (precomputed into the package), plus the TS `evaluate()` for anything not in the package (a judge synced late, a swapped item).
- **m6:** the greedy algorithm (from m6's Notes) and LATE_REQUEST alerts (boarding alerts).
- **m2:** `CabinTheme`, `SeatMap`, `VerdictBadge`, `StatusChip`.

## Provides (what others rely on)
- **Endpoints:** `GET /api/flights/{id}/crew-package` (includes `verdicts[passenger_id][item_id]`, `expected_specials`, `seed_epoch`) and `POST /api/flights/{id}/crew-events` (idempotent on `client_id`; events from an older `seed_epoch` are ignored).
- C4/C5 events, item status changes (`loaded`, `missing`, `served`), swaps (`assigned_passenger_id`), MISSING_TRAY / RED_SCAN alerts.

## Rules
- **The galley check counts only expected specials:** items of kind `special` assigned to passengers on the latest acknowledged meal list. Judges' late matches and spares are listed separately, so "7 of 8" stays true.
- **The QR payload is the bare item id.** The 6-character manual code is the same id without the `TB-` prefix.

## Tasks
- [x] **T1 Backend package + events (35 min).** Package (flight, passengers, promises, items, specs, verdict matrix, expected specials, epoch), events endpoint, tests.

  _Done when:_ the package for JL740 is under 300 KB, and replaying the same events twice gives `duplicates = n`.
- [ ] **T2 Offline kit (45 min).**
  - `vite-plugin-pwa` precache of the app shell and fonts.
  - Dexie stores: package, events queue.
  - "Download for flight" → "Ready offline · 03:35".
  - Sync on reconnect, plus an online/offline badge.

  _Done when:_ after a download, Chrome DevTools offline + reload still opens `/crew` with the data.
- [ ] **T3 Galley check (45 min).** Expected specials by galley, with tap or scan to mark found. Missing → greedy backup suggestion → "Use backup" swap event.

  _Done when:_ offline, 27D missing leads to the G2 backup suggestion, and the swap syncs on reconnect (C4 + assignment).
- [ ] **T4 Scan (40 min).** `qr-scanner` camera + manual code → look up the live seat → verdict (package matrix, or TS `evaluate`) → full-screen green/red with the rule in Japanese and English → C5.

  _Done when:_ scanning the AVML spare label (contains onion) for 23C shows red, and Priya's own tray shows green.
- [ ] **T5 Seat map + alerts + devices (40 min).** SeatMap with diet badges in JA/EN, judges' seats live when online, boarding alerts from m6. Test on the iPad (Safari) over the tunnel and on Android Chrome.

  _Done when:_ on the iPad, download, then airplane mode, then galley check + 2 scans, then reconnect: everything syncs.

## Done when
Act 5 runs on the iPad in airplane mode, and the same flow works in a laptop browser with DevTools offline (projector fallback).

## Notes
- Reload `/crew` online on the **current** tunnel address before switching to airplane mode. Each tunnel restart gives a new hostname.
- The iPad can be mirrored to Shefali's MacBook with QuickTime over a cable; this works in airplane mode.
