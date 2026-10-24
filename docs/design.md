# ThaliBento UI rules (v0, m2 finalises)

Five surfaces, one product. Judges compare screens side by side, so every module builds from `frontend/src/ui/` and these rules. Don't add new colours, fonts, shadows or one-off components in a module. If something is missing, ask the m2 owner, or build it inside your module from `ui/` parts.

## Look
- **Same identity as our deck:** aviation navy and blue on ice-white paper, with a boarding-pass motif on the passenger screens. Calm, precise, operational: it should read like a tool airline staff use for an 8-hour shift.
- **No** gradients, glassmorphism, glows, emoji, stock illustrations, hero images, decorative blobs, or sparkle icons. No lorem ipsum: use real data from `shared/seed`.

## Tokens (CSS variables in `frontend/src/styles/tokens.css`, mapped into Tailwind)
| Token | Value | Use |
|---|---|---|
| `--navy` | `#0A2A66` | headings, primary text on light, app bar |
| `--blue` | `#1F5FD1` | primary actions, links, focus ring |
| `--sky` | `#5E95EC` | secondary accents, charts |
| `--ice` | `#EAF1FC` | selected rows, info backgrounds |
| `--mist` | `#F5F8FD` | page background |
| `--line` | `#C7D6EF` | borders, dividers |
| `--grey` | `#55617D` | secondary text |
| `--safe` | `#1E7F4F` on `#E7F5EE` | SAFE, found, confirmed |
| `--warn` | `#9A6200` on `#FFF4DB` | NEEDS-HUMAN, at risk, deadline under 2 h |
| `--unsafe` | `#C8372B` on `#FBE9E7` | UNSAFE, lost, missing, red scan |

Rules for colour:
- Status colours mean **only** status, and are always shown with an icon **and** a word, never colour alone.
- Red is never decoration.
- Crew cabin mode (dark) uses `--cabin-bg #0B1220`, `--cabin-surface #131C2E`, `--cabin-line #24324D`, with the same status colours lifted for contrast.

## Type
- **Archivo** for headings and big numbers (600–700; tight letter-spacing on display sizes).
- **Inter** for UI text.
- **Noto Sans JP** for Japanese, **Hind** for Devanagari.
- All bundled through `@fontsource`, so they work offline.
- Scale: 12 / 14 (body, tables) / 16 (passenger body) / 20 / 24 / 32 / 48 (KPIs).
- Numbers, times, PNRs and seats use tabular figures (`font-variant-numeric: tabular-nums`). PNRs and item ids are monospace.

## Layout and spacing
- 4 px base grid; spacing comes from the Tailwind scale only. Radius: 6 px for controls, 10 px for cards. One shadow level for overlays only; cards use a 1 px `--line` border, not shadows.
- **Desktop** (ops, caterer, insights, rules, demo): left nav, a page header with title + flight context bar (JL740 · DEL 04:35 → NRT 15:20 · sim clock IST/JST · countdown to the next deadline), then content. Tables are dense: 36 px rows, sticky header.
- **Mobile** (passenger, join): one column, 16 px gutters, large tap targets (min 44 px), primary action pinned at the bottom.
- **Tablet** (crew): landscape first; works on an iPad mini and a phone. Large touch targets (min 48 px), dark cabin mode by default, Japanese first with English underneath.

## Components
From `frontend/src/ui/`:
- **m0 ships:** Button, Input, Checkbox, Card, Badge, Tabs, Dialog, Toast, Table.
- **m2 adds by ~18:30:** StatusChip, VerdictBadge, Countdown, Timeline, KpiTile, DataTable, RawMessage, DiffView, SeatMap, PageHeader, FlightContextBar, EmptyState, DualClock, LangSwitch.

Use them; don't restyle them per page.

Charts: Recharts. Series use `--blue`, `--sky` and `--grey`; status colours only for status series. No 3D, no pie charts with more than 4 slices, axis labels in `--grey` at 12 px.

## Words
- Plain, operational English, as in the deck: "Request again", "Meal list v3 received 00:40", "27D: use the backup veg meal from galley 2".
- Every verdict shows **why**: the rule that fired ("contains onion · 23C eats no onion or garlic").
- Use real codes and formats: AVML, VJML, HNML, `6XK2QP`, `TB-7K2Q9F`, `-NRT156Y`. Times are shown with their zone: "00:40 IST", "15:20 JST".
- Hindi and Japanese strings live in each module's `i18n.ts`. Keep the English short so translations fit.
- Nothing infers religion. Labels say what's excluded ("no onion, no garlic"), not who the person is.

## States
Every list has a loading skeleton, an empty state that says what will appear and when, and an error state with a retry. Live data polls every 2 s; don't flash the whole screen on refresh.

## Motion
150–200 ms ease-out on state changes only (alert arrives, scan result). No looping animation except a subtle pulse on a live countdown under 15 minutes.

## Check before you ship a screen
- [ ] Uses only `ui/` components and tokens; no new hex values
- [ ] Status always shown as icon + word
- [ ] Real seed data, no placeholder text
- [ ] Looks right at 1440 px (desktop), 390 px (phone) and 1024 × 768 (tablet), as relevant
- [ ] Hindi and Japanese strings don't overflow
