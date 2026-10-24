# m12: polish + hardening

**Owner:** Gunagye (lane a) · **Branch:** `gunagye/m12-polish` · **Phase:** freeze, 02:00–05:30 IST
**Status:** in progress (T1 done; T2–T4 wait for the 02:00 freeze) <!-- not started | in progress | blocked: <why> | done -->

## Goal
Make the five surfaces look like one finished product on the projector, the iPad and the judges' phones, and make the demo setup boring and repeatable.

## Owns
- `scripts/tunnel.sh`
- **After the 02:00 freeze:** style-only edits (classes, spacing, copy, empty states) in any `frontend/src/modules/*`. Owners sync before they touch their files again.

## Uses (contracts it reads)
- `docs/design.md` checklist, every module's screens, m11's `/demo`.

## Provides (what others rely on)
- `bash scripts/tunnel.sh`: starts a Cloudflare quick tunnel to `:8000` and prints the HTTPS address. Requires `cloudflared` (`winget install Cloudflare.cloudflared`).
- A finished look across `/p`, `/j`, `/ops`, `/caterer`, `/crew`, `/insights`, `/demo`.

## Tasks
- [x] **T1 Tunnel + demo build (20 min).** `tunnel.sh`, and a check that `npm run demo` serves everything from one origin.

  _Done when:_ a phone on mobile data opens `/j` over the tunnel and joins.
- [ ] **T2 Visual pass (90 min).** Walk every screen against the `docs/design.md` checklist at 1440 px, 1920 × 1080 (projector), 390 px and 1024 × 768. Fix alignment, hierarchy, copy, and empty/loading/error states.

  _Done when:_ every screen in the story passes the checklist; screenshots go to the pitch deck.
- [ ] **T3 Device pass (45 min).** iPad Safari (download, then airplane mode, then the galley check), Android Chrome, both iPhones (judge join), projector readability from 5 m.

  _Done when:_ the full story works on the real devices twice in a row.
- [ ] **T4 Speed + offline re-test (30 min).** Bundle size, the Japanese font subsets, first-load time on the tunnel; a fresh offline test on the iPad.

  _Done when:_ `/j` loads in under 3 s on a phone over the tunnel, and `/crew` reloads offline.

## Start here (next lane A session, written 19:00 IST)
Lane A's queue (m0 → m2 → m8 → m12): m0, m2 and m8 are **done**; m12 is the last module. Lane A also took over the m3 form from Shefali (see `docs/decisions.md`), so m3 fixes are lane A's too. Everything below is on main; nothing is only on the laptop.

**Running on Gunagye's laptop (started by the lane A session):**
- Demo server: `bash scripts/demo.sh --reset` → :8000 (built frontend + API, one origin). After pulling new code: stop it, `npm install`, `uv pip install --python backend/.venv -r backend/requirements.txt`, start it again.
- Tunnel: `bash scripts/tunnel.sh` → **https://losing-plasma-colour-combined.trycloudflare.com** (`/j`, `/crew`, `/demo`, `/ops`). If the tunnel restarts the address changes: reopen `/demo` (judge QR) and `/crew` online on the new address before airplane mode.
- If port 8000 is taken by an old run: `netstat -ano | findstr :8000`, then `taskkill /PID <pid> /T /F`. Stopping background `npm run dev` runs can leave watchfiles/uvicorn orphans behind; kill those too (leave lane B's Vite on :5180 alone).

**Next steps, in order:**
1. ~~Late-request desk drops allergies~~ **fixed 19:12** on `gunagye/m6-matcher` (f74df48): `LateDesk` sends `toRequest(diet)`. Checked in Chrome: veg + milk allergy now forbids dairy; an allergy alone enables "Find a safe meal". The demo build on :8000 was rebuilt with it.
2. **Q&A sheet checked 19:20** (docs repo `06-deliverables/final-pitch/qa-sheet.md`). Q6's `/api/recipes/eval`, the 625 shared test cases and m5's "Request again" all match the app. **Q5 now matches too:** lane B stopped storing preset names (`Profile.presets` is always `[]`), and lane A (33a3cb6) made the C1 line list the food rules only, the same wording for live joins and the seed: "Profile saved: no pork, meat without halal certification, alcohol, gelatin → MOML" (`profile_line()` in m3 `options.py`; no diet name, no kitchen note). Checked over the tunnel with a Halal judge. Still on the meal order, by design: the tray mark "HALAL" on MOML trays and the booked SSR notes (DIABETIC, VRAT, EGGETARIAN) that come in on the PNL.
3. **After the 02:00 freeze, T2 visual pass:** every story screen (`/p`, `/j`, `/ops`, `/ops/late`, `/caterer`, `/caterer/labels`, `/caterer/recipes`, `/crew`, `/insights`, `/demo`) at 1440, 1920×1080, 390 and 1024×768 against the `docs/design.md` checklist; style-only edits in any module (owners sync first). Screenshots for the deck.
4. **T3 device pass:** iPad Safari (download → airplane mode → galley check + 2 scans → reconnect), Android Chrome, both iPhones on mobile data joining `/j`; the full story twice in a row; projector readable from 5 m.
5. **T4 re-test:** `/j` first load measured 1.4–2.5 s over the tunnel (one cold run ~4 s); re-measure after the visual pass, plus a fresh offline run on the iPad.

**How lane A tested (works well here):** Playwright scripts with `playwright-core` and the installed Chrome (`chromium.launch({ channel: "chrome" })`), at `devices["Pixel 7"]` and `devices["iPad Pro 11 landscape"]` with touch. The in-app preview browser can't register service workers, so offline checks must run in real Chrome/Safari. A worktree under the scratchpad needs `git -c core.longpaths=true` on Windows.

**Done so far this session (for context):** crew tablet redesign (app bar, numbered tasks, guided seat service, `SeatMap variant="plane"`, 日+EN / 日本語 / EN switch), m3 form rework (three questions, SPML fallback, judges change answers on the same seat), gzip + asset caching for the tunnel, the m3 test fix that let m4 ship.

## Done when
The 07:00 dry run needs no fixes to visuals or setup.

## Notes
- If the tunnel restarts, the address changes: reopen `/demo` and `/crew` on the new address before switching to airplane mode.
- 17:00 · cloudflared 2026.10.3 installed on Gunagye's laptop (winget). `npm run tunnel` (or `bash scripts/tunnel.sh`) with `bash scripts/demo.sh` running prints the addresses.
- Gzip + immutable caching for `/assets/*` in `main.py`: `/j` over the tunnel went from ~5 s to 1.6–2.5 s on a phone-sized Chrome (Playwright); the crew package from 194 KB to 13 KB.
- Crew offline flow verified over the tunnel address in Chrome (download → offline reload → galley + swap + 2 scans → reconnect → synced). Still to do on real devices: iPad Safari, Android Chrome, the iPhones on mobile data.
- Projector: connect it to Shefali's MacBook. It shows `/demo` and the other screens over the tunnel, plus the iPad mirrored with QuickTime over a cable. Gunagye's laptop only runs the server.
- 19:00: T1 done. `npm run tunnel` works with cloudflared 2026.10.3 (winget); Gunagye's phone opened `/j` over the tunnel and joined (passenger and judge views "look fine and work"). Mobile data specifically still to confirm in T3.
- 22:15 · **Full story run before Integration 2**, over the tunnel, every click from `docs/demo-script.md`: projector 1920×1080 (`/demo`, `/ops`, `/caterer`, `/ops/late`, `/insights`), Priya's phone (Pixel 7), a judge's phone (iPhone 13) and the iPad (landscape, offline for Acts 6–7). Acts 0–8 all pass; no server errors. Fixed on the way (all on main):
  - Crew syncs ran in parallel on fast taps while online, and the server answered 500 (duplicate event). Syncs now run one at a time, and a racing duplicate counts as a duplicate.
  - After an offline reload the tablet stamped some scans with the real clock (the clock hook went blank on every retry). It now keeps the stored offset.
  - Offline scans kept the tablet's stale sim time (03:35, before take-off) after `/demo` moved the clock to 05:20. Events now carry `wall_at`; the server places them on the sim clock (`clock.at_wall`). Priya's journey on `/insights` reads C1 → C2 → C2 fixed → C3 → C4 05:20 → C5 05:20.
  - "Saved 02:50" when Download was tapped right after a step: the label now uses the server's package time.
  - C1 line spells out six rules, so Priya's ends "…onion, garlic → AVML".
- For Bhavyam (demo script): `/ops/late` now shows "CP-SAT · N ms · 0 swaps · **10** meals checked" for Mehta, not 11; read the number off the screen. The iPad caches the app about 12 s after `/crew` first opens; wait that long before airplane mode.
- 23:00 · **Workflow rework** (Gunagye found the walk-through confusing; all on main, 620355d):
  - `/demo` is a presenter cockpit: a step strip, then for the current step the device and screen (with Open), the clicks in order, the line to say, what the room sees, and Priya's five hand-offs filling in live. Next names the next step. The script lives in `frontend/src/modules/m11-demo/script.ts`.
  - Every projector screen shows a **story guide bar** under the flight bar while the story runs: act and time, "This screen: …", "Do here: …", and Priya's hand-offs. "Hide guide" turns it off (remembered per browser).
  - `/ops`: "How it works" in three steps, a plain line under each number, alerts as clickable rows, and a **meal-promise board** (every promise across Diet → Booking → Caterer → Galley → Seat). Judges' reserved-meal notes no longer count as open problems.
  - Crew seat map: tap a seat to see who sits there, what they can't eat, their tray and its status. A judge who joined after the download shows with "Download again before departure".
  - Priya's phone: "Where your meal is" with her five hand-offs. Her old PNR (6XK2QP) still finds her after the rebooking, so a reload mid-demo doesn't strand the phone.
  - For Bhavyam: `docs/demo-script.md` still says "Next: /p" etc.; the buttons now read "Next: <step title>". The clicks themselves are unchanged.
- 23:30 · **Walkthrough video** (`ThaliBento-demo-walkthrough.mp4`, about 5 min, 1080p): recorded from real screenshots of a full run over the tunnel (projector, Priya's phone, a judge's phone, crew iPad), with the cursor/finger on every click and captions with the narrator's lines. Kept outside the repo (too big for git).
