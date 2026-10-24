# m22: Seatback meal check

**Owner:** Gunagye (lane b) · **Branch:** `gunagye/m22-seatback` · **Phase:** v2 addition, 25 Oct 02:00–06:00 IST
**Status:** done <!-- not started | in progress | blocked: <why> | done -->

## Goal
30–45 minutes before the meal service, the crew press **Ask seats now** on the copilot. Every seat with a special or held meal asks on its own screen: "Your pre-ordered meal — still right?" with **Yes**, **No, skip** and **Change**. The answer reaches the crew tablet live over the cabin network, so the crew bring confirmed trays first, a skipped tray goes to the next request on board, and a change is checked by the rules engine before anyone carries it. No answer: the crew ask in person. The tray scan at the seat stays the final check, because a tap on a screen doesn't prove who is sitting there.

## Owns
- `backend/app/modules/m22_seatback/`, `backend/tests/test_m22_seatback.py`
- `frontend/src/modules/m22-seatback/` (page `/seat?seat=23C`)
- additions inside m8/m20: `SeatbackPanel.tsx` and the seat-screen chips on the copilot (`CopilotTask`, `ServeList`, `CopilotCard`), `BoardingPassFind.tsx` and `boardingPass.ts` (seat service by boarding pass)
- one line each in `backend/app/registry.py`, `frontend/src/app/routes.tsx`, `frontend/src/app/nav.ts`; the m22 section of `shared/api.md`

## Uses (contracts it reads)
- m18 `service.assignments` (who has a special or held meal), `resolve_rules`, `context` helpers; m18 reads back `service.released_items` in its release rung
- m6 `inventory.load` (what is free and not owed to anyone), m1 `engine.evaluate` through m18's `fits`
- m17 passport rules and language; core outbox (crew notifications) and checkpoint events (C5 `info`)

## Provides
Endpoints in `shared/api.md` (`## m22`), `useSeatbackStatus` / `useAskSeats` / `STATUS_LOOK` from `@/modules/m22-seatback`.

## Tasks
- [x] **T1 Backend:** `SeatAsk` table, ask / status / seat view / options / answer, release hook for the router, C5 info lines, crew notifications · _done when:_ `pytest backend/tests/test_m22_seatback.py` (12 tests)
- [x] **T2 Seat screen** `/seat`: 16:9 in a bezel on a laptop, full screen on a phone; initials only; "Show my meal" reveals the dish and the tray's food rules; Yes / No, skip / Change; safe swaps; undo after No; EN / HI / JA, opening in the passenger's language; seat picker without `?seat=`
- [x] **T3 Copilot:** "Ask seats now" (needs the cabin network), counts, "Confirmed at seat: deliver now", "No answer: ask in person", a chip per serve-list row and on the seat card, the scan reminder
- [x] **T4 Story:** step 4 cue and "Do it for me" ask the seats and answer Yes at 23C before the scans; smoke step "seat screens before the meal"; `docs/demo-script.md` lines
- [x] **T5 Seat service by boarding pass** (m8): scan or type the BCBP code, or the booking reference on it; a rebooked passenger is still found by name

## Done when
On the story run, the crew ask the seats, `/seat?seat=23C` shows "P. S. · Seat 23C" and the question, Yes turns 23C to "Confirmed at seat" on the copilot within 2 s, and the smoke passes.

## Notes
- **Who is asked:** the router's onboard plan, first row per passenger: 87 of 186 on JL740 after Chaos Mode (31 special trays, 56 main courses held by a passport plan). A seat whose tray is already served isn't asked; seats that answered keep their answer on a second press.
- **Change** offers only trays nobody holds that fit every rule the passenger has on the flight date: a meal freed by a no-show or another seat, a spare special meal, or a main above the count still owed in that cabin. Reserve pouches are never offered (they stay for needs only they can meet). On the story run 23C (fast day) gets "Nothing else on board fits", 31K (Jain, from the gate change) gets nothing, a no-beef passenger gets chicken or paneer.
- **Rules for a change** come from the passport, profile or booked code; for a passenger who only told the gate (31K) from the router's change event. Found while testing: without that, 31K was offered chicken. Fixed and pinned by a test.
- **Waste metrics** don't count seat skips: a passenger who doesn't want their meal is the same in both worlds, and a skipped tray the router passes on is a bonus.
- **Offline story:** the demo laptop is the aircraft server; seat screens and the crew tablet reach it over the cabin network (laptop hotspot) with the internet off. Answers show on the tablet while it is connected; the downloaded package and the offline sync are unchanged.
- **Privacy:** the seat screen shows initials only; the dish and the tray's food rules appear after a tap, in normal-size text; no diet or festival names on screen.

### Feasibility notes for the pitch (checked 25 Oct)
- JAL's 787s fly Thales AVANT, an Android-based seatback system. JAL was the first airline in Asia to put AVANT on a 787 (2014), and that cabin launched with **meal ordering** and the JAL Shop on the seatback; the 787-9's software adds JAL apps for on-board shopping and meal orders. Sources: [Thales, JAL 787-9 with AVANT](https://www.thalesgroup.com/en/worldwide/aerospace/press-release/thales-and-japan-airlines-celebrate-entry-service-their-first), [Future Travel Experience, Dec 2014](https://www.futuretravelexperience.com/2014/12/jal-first-airline-in-asia-to-adopt-avant-ife-technology/), [APEX on AVANT as the first Android IFE](https://apex.aero/articles/40-success-stories-thales-innovated-avant-ife-portfolio/).
- JetBlue Mint passengers order on the seatback screen and the order goes to an iPad in the galley; since 2025 JetBlue seatbacks also offer allergen modifications. Sources: [The Points Guy](https://thepointsguy.com/news/jetblue-wireless-meal-ordering), [Future Travel Experience, Apr 2025](https://www.futuretravelexperience.com/2025/04/jetblue-further-personalises-the-inflight-experience-with-expanded-meal-selection-and-more-tailored-entertainment/).
- What we claim: we can't install on a real JAL screen. Pitch it as a small add-on: one question screen in the seatback's existing meal-order app plus a feed to the crew tablet, the pattern JetBlue already runs. The vendor sources are press releases, so current JAL cabins may differ.
