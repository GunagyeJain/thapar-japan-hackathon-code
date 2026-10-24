# ThaliBento UI rules (v1)

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

In Tailwind: `bg-navy`, `text-blue`, `text-sky`, `bg-ice`, `bg-mist`, `border-line`, `text-grey`, `bg-safe-bg text-safe`, `bg-warn-bg text-warn`, `bg-unsafe-bg text-unsafe`. Prefer the semantic ones that flip in cabin mode: `bg-background`, `bg-card`, `text-foreground`, `text-muted-foreground`, `border` (= `--line`), `bg-muted`, `text-primary`.

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
- Numbers, times, PNRs and seats use tabular figures (class `tabular`). PNRs, item ids and raw messages are monospace (class `code`). Headings and big numbers: `font-display`.

## Layout and spacing
- 4 px base grid; spacing comes from the Tailwind scale only. Radius: 6 px for controls, 10 px for cards. One shadow level for overlays only; cards use a 1 px `--line` border, not shadows.
- **Desktop** (ops, caterer, insights, rules, demo): left nav, a page header with title + flight context bar (JL740 · DEL 04:35 → NRT 15:20 · sim clock IST/JST · countdown to the next deadline), then content. Tables are dense: 36 px rows, sticky header.
- **Mobile** (passenger, join): one column, 16 px gutters, large tap targets (min 44 px), primary action pinned at the bottom.
- **Tablet** (crew): landscape first; works on an iPad mini and a phone. Large touch targets (min 48 px), dark cabin mode by default, Japanese first with English underneath.

## Components
Import everything from `@/ui` (`frontend/src/ui/index.ts`). The live gallery with real JL740 data is at **`/ui`**, light on the left and cabin dark on the right. If something is missing, ask the m2 owner, or compose it inside your module from these parts.

| Component | Use it for | Example |
|---|---|---|
| `Button` | actions (`default`, `outline`, `secondary`, `ghost`, `destructive`; sizes `sm`, `lg`, `icon`) | `<Button onClick={approve}>Request again</Button>` |
| `Input`, `Checkbox` | forms | `<Checkbox checked={v} onCheckedChange={setV} />` |
| `Card` (+ `CardHeader`, `CardTitle`, `CardContent`) | a bordered panel (no shadow) | `<Card><CardHeader><CardTitle>Meal list v3</CardTitle></CardHeader>…</Card>` |
| `Badge` | codes and small tags, not status | `<Badge variant="secondary" className="code">AVML</Badge>` |
| `Tabs`, `Dialog`, `Popover` | in-page sections, confirmations, details on demand | `<Dialog><DialogContent><DialogTitle>Approve fix?</DialogTitle>…` |
| `Table` | simple static tables | `<Table><TableHeader>…` |
| `toast` / `Toaster` | short confirmations ("SSR draft sent") | `toast.success("Meal list v3 acknowledged")` |
| `StatusChip` | any status: icon + word, `safe` `warn` `unsafe` `info` `neutral` | `<StatusChip status="unsafe" label="Lost on rebooking" />` |
| `VerdictBadge` | SAFE / UNSAFE / NEEDS_HUMAN, with the fired rules in a popover | `<VerdictBadge verdict={r.verdict} fired={r.fired} lang={lang} />` |
| `Countdown` | time left to a deadline on the sim clock; warns under `warnUnder`, pulses under 15 min | `<Countdown until={alert.deadline_at} warnUnder="2h" />` · `size="lg"` for a tile |
| `DualClock` | sim time in IST and JST | `<DualClock size="lg" />` |
| `FlightContextBar` | JL740 route, sim clock, next hand-off. DesktopLayout already shows it | – |
| `PageHeader` | the top of every desktop page | `<PageHeader eyebrow="JL740 · 25 Oct" title="Ops console" actions={…} />` |
| `KpiTile` | a big number with a label and an optional status | `<KpiTile label="Caught before deadline" value="3/3" status={{status: "safe", label: "On time"}} />` |
| `DataTable` | dense lists: sortable columns, sticky header, row click, loading skeleton, empty state | `<DataTable rows={alerts} columns={cols} rowKey={(a) => a.id} onRowClick={open} />` |
| `Timeline` | a promise's C1–C5 events with the breakpoint marked | `<Timeline events={t.events} breakpoint={t.breakpoint} />` |
| `RawMessage` | a PNL/ADL as received, highlighted lines | `<RawMessage title="ADL 2 · 23:02 IST" text={msg.text} highlight={{5: "remove", 7: "add"}} />` |
| `DiffView` | before → after lines (`diffLines()` is exported too) | `<DiffView before={v2Lines} after={v3Lines} beforeLabel="v2" afterLabel="v3" changesOnly />` |
| `SeatMap` | the B787-8 cabin from `flight.cabins`: per-seat status, mark, highlight, click | `<SeatMap cabins={flight.cabins} seats={{"23C": {status: "safe", mark: "A"}}} highlight={["23C"]} />` |
| `EmptyState` | says what will appear and when | `<EmptyState title="No ADL received yet" body="Changes appear here when the feed sends an ADL." />` |
| `LangSwitch` | EN / हिन्दी / 日本語 | `<LangSwitch value={lang} onChange={setLang} />` |
| `CabinTheme` | dark cabin tokens for anything outside `/crew` | `<CabinTheme>…</CabinTheme>` |

Helpers you'll want with them: `useFlight()` and `flightDeadlines()` (`@/lib/flight`), `useSimClock()` and `msUntil()` (`@/lib/clock`), `fmtTime(iso, "IST" | "JST", {date})`, `fmtDuration()` and `fmtPaxName()` (`@/lib/format`), `t(text, lang)` (`@/lib/i18n`), entity types in `@/lib/types`.

Charts: Recharts. Series use `--blue`, `--sky` and `--grey`; status colours only for status series. No 3D, no pie charts with more than 4 slices, axis labels in `--grey` at 12 px.

## Page templates
**Desktop** (`layout: "desktop"`: ops, caterer, insights, rules, demo). The layout gives the left nav and the sticky JL740 context bar; the page brings the rest:
```tsx
<div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
  <PageHeader eyebrow="JL740 · 25 Oct" title="Ops console" subtitle="2 open alerts" actions={<Button>…</Button>} />
  <div className="grid gap-4 lg:grid-cols-4">{/* KpiTiles */}</div>
  <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
    <DataTable … />            {/* the list */}
    <Card>…</Card>             {/* the selected item: evidence, RawMessage, actions */}
  </div>
</div>
```
**Mobile** (`layout: "mobile"`: `/p`, `/j`). One column inside the 16 px gutters, 16 px body text, tap targets of at least 44 px (`size="lg"` buttons), the primary action pinned at the bottom:
```tsx
<div className="flex flex-col gap-4">
  <LangSwitch value={lang} onChange={setLang} />
  <h1 className="text-2xl font-bold">{t(copy.title, lang)}</h1>
  {/* steps */}
  <div className="fixed inset-x-0 bottom-0 border-t bg-card p-4">
    <Button size="lg" className="w-full">Confirm</Button>
  </div>
</div>
```
**Tablet** (`layout: "tablet"`: `/crew`). Dark cabin mode is on for the whole page. Landscape first, touch targets of at least 48 px, Japanese first with English underneath:
```tsx
<div className="grid gap-5 lg:grid-cols-[1fr_360px]">
  <section>{/* galley list or SeatMap size="md" */}</section>
  <aside>{/* scan result: StatusChip size="lg" + why */}</aside>
</div>
<p lang="ja" className="text-lg">27D：ギャレー2の予備ベジ食を使用</p>
<p className="text-muted-foreground">27D: use the backup veg meal from galley 2</p>
```

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
