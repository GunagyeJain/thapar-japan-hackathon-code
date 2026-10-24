# m12: polish + hardening

**Owner:** Gunagye (lane a) · **Branch:** `gunagye/m12-polish` · **Phase:** freeze, 02:00–05:30 IST
**Status:** not started <!-- not started | in progress | blocked: <why> | done -->

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
- [ ] **T1 Tunnel + demo build (20 min).** `tunnel.sh`, and a check that `npm run demo` serves everything from one origin.

  _Done when:_ a phone on mobile data opens `/j` over the tunnel and joins.
- [ ] **T2 Visual pass (90 min).** Walk every screen against the `docs/design.md` checklist at 1440 px, 1920 × 1080 (projector), 390 px and 1024 × 768. Fix alignment, hierarchy, copy, and empty/loading/error states.

  _Done when:_ every screen in the story passes the checklist; screenshots go to the pitch deck.
- [ ] **T3 Device pass (45 min).** iPad Safari (download, then airplane mode, then the galley check), Android Chrome, both iPhones (judge join), projector readability from 5 m.

  _Done when:_ the full story works on the real devices twice in a row.
- [ ] **T4 Speed + offline re-test (30 min).** Bundle size, the Japanese font subsets, first-load time on the tunnel; a fresh offline test on the iPad.

  _Done when:_ `/j` loads in under 3 s on a phone over the tunnel, and `/crew` reloads offline.

## Done when
The 07:00 dry run needs no fixes to visuals or setup.

## Notes
- If the tunnel restarts, the address changes: reopen `/demo` and `/crew` on the new address before switching to airplane mode.
- Projector: connect it to Shefali's MacBook. It shows `/demo` and the other screens over the tunnel, plus the iPad mirrored with QuickTime over a cable. Gunagye's laptop only runs the server.
