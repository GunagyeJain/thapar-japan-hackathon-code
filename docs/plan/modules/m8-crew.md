# m8: crew tablet (offline)

**Owner:** Gunagye (lane a) · **Branch:** `gunagye/m8-crew` · **Phase:** 2, 18:00–23:30 IST
**Status:** done <!-- not started | in progress | blocked: <why> | done -->

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
- [x] **T2 Offline kit (45 min).**
  - `vite-plugin-pwa` precache of the app shell and fonts.
  - Dexie stores: package, events queue.
  - "Download for flight" → "Ready offline · 03:35".
  - Sync on reconnect, plus an online/offline badge.

  _Done when:_ after a download, Chrome DevTools offline + reload still opens `/crew` with the data.
- [x] **T3 Galley check (45 min).** Expected specials by galley, with tap or scan to mark found. Missing → greedy backup suggestion → "Use backup" swap event.

  _Done when:_ offline, 27D missing leads to the G2 backup suggestion, and the swap syncs on reconnect (C4 + assignment).
- [x] **T4 Scan (40 min).** `qr-scanner` camera + manual code → look up the live seat → verdict (package matrix, or TS `evaluate`) → full-screen green/red with the rule in Japanese and English → C5.

  _Done when:_ scanning the AVML spare label (contains onion) for 23C shows red, and Priya's own tray shows green.
- [x] **T5 Seat map + alerts + devices (40 min).** SeatMap with diet badges in JA/EN, judges' seats live when online, boarding alerts from m6. Test on the iPad (Safari) over the tunnel and on Android Chrome.

  _Done when:_ on the iPad, download, then airplane mode, then galley check + 2 scans, then reconnect: everything syncs.

## Done when
Act 5 runs on the iPad in airplane mode, and the same flow works in a laptop browser with DevTools offline (projector fallback).

## Notes
- Reload `/crew` online on the **current** tunnel address before switching to airplane mode. Each tunnel restart gives a new hostname.
- The iPad can be mirrored to Shefali's MacBook with QuickTime over a cable; this works in airplane mode.
- **Verified in Chrome (Playwright, 1024×768) on `npm run demo`:** download → offline → reload `/crew` opens from the service worker → galley 1 "7 of 8 found" → 27D missing → suggestion → swap → "8 of 8" → 23C scan: AVML spare red (contains onion, garlic), `TB-7K2Q9F` green → 11 events queued → reconnect → all synced (C4 fixed for 27D, C5 for 23C).
- The service worker only exists in the production build (`npm run demo`, port 8000), not in `npm run dev`. The in-app preview browser can't register service workers; use Chrome, Safari or Edge.
- Greedy backup (no m6 notes yet): a free spare special first, then a sealed backup; same galley first; must be SAFE for the passenger. Before Act 4, 27D gets the spare VJML in G2; after Mehta's late request reserves it, 27D gets the sealed backup in G2.
- Expected specials fall back to every assigned special until m7's `MealListVersion` is on main (then: the latest acknowledged list). The galley check counts per galley (G1 has 8, G2 has 16 with the group).
- Package `forbid[passenger_id]`: the profile's forbid, or for SSR-only passengers what the booked code excludes plus the kitchen note (`NO ONION NO GARLIC` → onion, garlic), so 23C scans red even before Priya fills the form.
- T5 left: seat map with diet badges and the crew inbox (`/api/notifications?to=crew:JL740`) are built; still to do: the iPad Safari + Android run over the tunnel.
- 17:55: language switch on `/crew` (日本語 + EN, 日本語, English), saved on the tablet; every crew string, dish name, scan result and rule reason follows it. Checked with touch input at iPad Pro 11 landscape in Chrome: tab taps, galley check + backup swap, seat scan, no console errors.
- 18:30 redesign after the iPad review: app bar (flight + sim time, connection chip with the unsynced count, "Saved 18:00" update button, a compact 日+EN / 日本語 / EN switch on the right), a first-run setup card with three steps, then three numbered task cards (1 galley check, before boarding · 2 seat service, during meal service · 3 seat map) with live progress and a one-line how-to. Galley: galley cards with progress bars + label scan on the left, trays on the right. Seat service: ① pick the seat (special-meal seat chips + who sits there and what they can't eat) → ② scan the tray. Seat map: `SeatMap variant="plane"` inside the aircraft outline. Re-checked with touch at iPad Pro 11 landscape and the full offline run.
- 18:55: device run done. Gunagye checked the redesigned `/crew` on the iPad over the tunnel (looks good, works). m8 done.
