# m2: design system

**Owner:** Gunagye (lane a) · **Branch:** `gunagye/m2-design-system` · **Phase:** 1, 17:00–18:15 IST. Keep it tight: build only what the acts use, so m8 starts by 18:15.
**Status:** in progress <!-- not started | in progress | blocked: <why> | done -->

## Goal
One look across five surfaces, so the product reads as a real airline tool and not five student pages. It continues the deck's identity (navy/blue on ice, boarding-pass details) and gives every module ready-made status, data and layout components.

## Owns
- `frontend/src/ui/`, `frontend/src/app/layouts/`, `frontend/src/styles/`
- `docs/design.md`
- `frontend/src/modules/m2-ui/` (the `/ui` gallery)

## Uses (contracts it reads)
- Seed data (for gallery examples), `useSimClock()` from m0

## Provides (what others rely on)
All exported from `@/ui`:
| Component | Notes |
|---|---|
| `StatusChip` | `{status: "safe" \| "warn" \| "unsafe" \| "info" \| "neutral", label}` |
| `VerdictBadge` | `{verdict, fired?}`, with the rules in a popover |
| `Countdown` | `{until, warnUnder="2h"}`; sim clock; pulses under 15 min |
| `DualClock` | IST/JST |
| `FlightContextBar` | JL740 route, times, sim clock, next deadline |
| `PageHeader` | `{title, subtitle?, actions?}` |
| `KpiTile` | `{label, value, delta?, status?}` |
| `DataTable` | dense, sortable, sticky header, row click |
| `Timeline` | C1–C5 events with result icons and a breakpoint marker |
| `RawMessage` | monospace teletype block with highlighted lines |
| `DiffView` | before / after lines |
| `SeatMap` | B787-8 layout from the flight's cabins, per-seat badge, highlight |
| `EmptyState` | |
| `LangSwitch` | EN / हिन्दी / 日本語 |
| `CabinTheme` | dark wrapper for crew |

Plus the final `docs/design.md`.

## Tasks
- [x] **T1 Tokens + type (30 min).** `tokens.css` (light + cabin dark), Tailwind theme mapping, fonts (two weights each; Japanese through fontsource unicode-range subsets), focus ring, tabular numbers utility.

  _Done when:_ the m0 home page uses the new tokens with no hard-coded hex anywhere in `src/`.
- [x] **T2 Status + chrome components (30 min).** StatusChip, VerdictBadge, Countdown, DualClock, FlightContextBar, PageHeader, EmptyState, LangSwitch; DesktopLayout nav styled.

  _Done when:_ the `/ui` gallery shows each one in light and cabin dark. **Ship** (heads-up: "use @/ui components; see docs/design.md").
- [ ] **T3 Data components (45 min).** DataTable, Timeline, KpiTile, RawMessage, DiffView, SeatMap (with Priya 23C, Mehta 31K and the row-5 judge seats in the example).

  _Done when:_ the gallery shows each one with seed data, and SeatMap renders all 186 seats on a 1024 px tablet. **Ship.**
- [ ] **T4 Rules doc + review (20 min).** Finalise `docs/design.md` with component usage notes and page templates for desktop, mobile and tablet.

  _Done when:_ the doc lists every component with one usage example.

## Done when
Every other module can build its screens only from `@/ui` and the tokens, and the gallery looks right at 1440 px, 390 px and 1024 × 768.

## Notes
_Owner's running notes._
