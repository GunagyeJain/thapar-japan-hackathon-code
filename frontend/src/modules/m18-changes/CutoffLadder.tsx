// The cutoff ladder: one flight from T-48 h to landing, the six windows with the rungs each still allows,
// the T-25 h line where today's process stops listening, the sim clock's "now", and one dot per change event.
// Exported for /demo too (the opening picture), so it fetches its own flight and clock.
import { CheckCircle2, Clock, Info, RefreshCw, XCircle, type LucideIcon } from "lucide-react"
import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react"

import { useSimClock } from "@/lib/clock"
import { useFlight } from "@/lib/flight"
import { fmtTime } from "@/lib/format"
import type { Flight } from "@/lib/types"
import { cn } from "@/lib/utils"
import { Button, EmptyState, StatusChip, type Status } from "@/ui"

import { CHANNELS, KINDS, ONBOARD_RUNGS, RUNGS, WINDOWS, WINDOW_RUNGS } from "./labels"
import { fmtSpan, ladderSegments, segmentStart, stackLanes, TOUCHPOINTS, windowAt, xOf, type Segment } from "./ladder"
import type { ChangeEvent, Window } from "./types"
import { numbered, outcomeOf } from "./words"

export interface CutoffLadderProps {
  /** Change events to pin on the ladder, one dot each. */
  events?: ChangeEvent[]
  selectedId?: string | null
  onSelect?: (id: string) => void
  /** Names only, no rungs and no "today" row: for the change desk or a small slot on /demo. */
  compact?: boolean
  className?: string
}

const STATUS_ICON: Record<Status, LucideIcon> = { safe: CheckCircle2, unsafe: XCircle, warn: XCircle, info: Info, neutral: Info }
const STATUS_TONE: Record<Status, string> = {
  safe: "border-safe/40 bg-safe-bg text-safe",
  unsafe: "border-unsafe/40 bg-unsafe-bg text-unsafe",
  warn: "border-warn/40 bg-warn-bg text-warn",
  info: "border-blue/30 bg-ice text-blue",
  neutral: "border-border bg-muted text-muted-foreground",
}
/** A dot's width plus a little air: closer dots stack into a second lane. */
const DOT_PX = 58
/** Used until the row has been measured. */
const DOT_GAP = 5.5
const LANE_PX = 34

/** The element's width in px, kept up to date (0 until measured). */
function useWidth<T extends HTMLElement>(): [RefObject<T | null>, number] {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return [ref, width]
}

export function CutoffLadder({ events = [], selectedId, onSelect, compact = false, className }: CutoffLadderProps) {
  const flight = useFlight()
  const { now } = useSimClock()
  const f = flight.data

  if (flight.isError) {
    return (
      <EmptyState
        className={className}
        title="Couldn't load JL740's milestones"
        body="The ladder is drawn from the flight's cutoff, caterer list, dispatch, boarding and departure times."
        action={
          <Button variant="outline" onClick={() => flight.refetch()}>
            <RefreshCw /> Retry
          </Button>
        }
      />
    )
  }
  if (!f) return <div className={cn("animate-pulse rounded-xl border bg-card", compact ? "h-40" : "h-80", className)} aria-busy="true" aria-label="Loading the cutoff ladder" />

  const segs = ladderSegments(f)
  const cutoffX = segmentStart(segs, 1)
  const nowX = now ? xOf(now, segs) : null
  const current = now ? windowAt(now, segs) : null
  const cols = segs.map((s) => `minmax(0,${s.weight}fr)`).join(" ")
  const label = (text: string) => (compact ? null : <RowLabel>{text}</RowLabel>)

  return (
    <figure className={cn("flex flex-col gap-3 rounded-xl border bg-card p-4 md:p-5", className)} aria-label="Cutoff ladder for JL740">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <span>
          <span className={cn("font-display font-semibold", compact ? "text-base" : "text-lg")}>The cutoff ladder</span>
        </span>
        <Legend hasEvents={events.length > 0} />
      </figcaption>

      <div className={cn("grid gap-x-3", compact ? "grid-cols-[minmax(0,1fr)]" : "grid-cols-[84px_minmax(0,1fr)]")}>
        {label("")}
        <CutoffCallout x={cutoffX} at={f.special_meal_cutoff} compact={compact} />

        {label("Today")}
        {!compact && <TodayRow x={cutoffX} />}

        {label("ThaliBento")}
        <WindowsRow segs={segs} cols={cols} current={current} nowMs={now?.getTime() ?? null} compact={compact} cutoffX={cutoffX} />

        {events.length > 0 && label("Changes")}
        {events.length > 0 && <EventsRow events={events} segs={segs} selectedId={selectedId} onSelect={onSelect} cutoffX={cutoffX} nowX={nowX} />}

        {label("")}
        <Axis segs={segs} f={f} nowX={nowX} now={now} compact={compact} />

        {label("Journey")}
        <Touchpoints cols={cols} />
      </div>
    </figure>
  )
}

function RowLabel({ children }: { children: ReactNode }) {
  return <span className="self-center text-xs font-semibold tracking-wide text-muted-foreground uppercase">{children}</span>
}

function Legend({ hasEvents }: { hasEvents: boolean }) {
  const items: { icon: LucideIcon; tone: string; text: string }[] = hasEvents
    ? [
        { icon: CheckCircle2, tone: "text-safe", text: "Met" },
        { icon: XCircle, tone: "text-unsafe", text: "Not met" },
        { icon: Info, tone: "text-blue", text: "Meal kept" },
      ]
    : []
  return (
    <span className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {items.map(({ icon: Icon, tone, text }) => (
        <span key={text} className="inline-flex items-center gap-1">
          <Icon className={cn("size-3.5", tone)} aria-hidden="true" /> {text}
        </span>
      ))}
      <span className="inline-flex items-center gap-1.5">
        <span className="h-3.5 w-[3px] rounded-full bg-navy" aria-hidden="true" /> Cutoff T-25 h
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-3.5 w-0.5 rounded-full bg-blue" aria-hidden="true" /> Now (sim clock)
      </span>
    </span>
  )
}

/** The two vertical lines every row carries, so they read as one line down the ladder. */
function Marks({ cutoffX, nowX }: { cutoffX: number; nowX?: number | null }) {
  return (
    <>
      <span className="pointer-events-none absolute inset-y-0 z-10 w-[3px] -translate-x-1/2 bg-navy" style={{ left: `${cutoffX}%` }} aria-hidden="true" />
      {nowX != null && (
        <span className="pointer-events-none absolute inset-y-0 z-10 w-0.5 -translate-x-1/2 bg-blue" style={{ left: `${nowX}%` }} aria-hidden="true" />
      )}
    </>
  )
}

function CutoffCallout({ x, at, compact }: { x: number; at: string; compact: boolean }) {
  return (
    <div className={cn("relative", compact ? "h-9" : "h-12")}>
      <Marks cutoffX={x} />
      <p className="absolute bottom-1.5 pl-2.5 leading-tight whitespace-nowrap" style={{ left: `${x}%` }}>
        <span className="block text-xs text-muted-foreground tabular">T-25 h · {fmtTime(at, "IST", { date: true })}</span>
        <span className={cn("block font-display font-bold text-navy", compact ? "text-sm" : "text-base")}>Today, the airline stops listening here</span>
      </p>
    </div>
  )
}

function TodayRow({ x }: { x: number }) {
  return (
    <div className="relative flex h-9 text-sm">
      <span className="flex min-w-0 items-center truncate rounded-l-md bg-muted px-3 font-medium" style={{ width: `${x}%` }}>
        Special meal (SSR)
      </span>
      <span className="flex min-w-0 flex-1 items-center truncate rounded-r-md border border-l-0 border-dashed px-3 text-muted-foreground">
        No channel after the cutoff
      </span>
      <Marks cutoffX={x} />
    </div>
  )
}

function rungLines(window: Window): { own: string[]; tail: string | null } {
  const rungs = WINDOW_RUNGS[window]
  if (window === "inflight") return { own: [], tail: "On-board rungs" }
  if (window === "onboard") return { own: rungs.map((r) => RUNGS[r].ladder ?? RUNGS[r].label), tail: null }
  const own = rungs.filter((r) => !ONBOARD_RUNGS.includes(r))
  const tail = own.length < rungs.length ? "+ on-board rungs" : null
  return { own: own.map((r) => RUNGS[r].ladder ?? RUNGS[r].label), tail }
}

interface WindowsRowProps {
  segs: Segment[]
  cols: string
  current: Window | null
  nowMs: number | null
  compact: boolean
  cutoffX: number
}

function WindowsRow({ segs, cols, current, nowMs, compact, cutoffX }: WindowsRowProps) {
  return (
    <div className="relative">
      <ol className="grid overflow-hidden rounded-md border" style={{ gridTemplateColumns: cols }}>
        {segs.map((s) => {
          const isNow = s.window === current
          const past = nowMs !== null && nowMs >= s.to
          const { own, tail } = rungLines(s.window)
          return (
            <li
              key={s.window}
              className={cn(
                "flex min-w-0 flex-col gap-1 border-l px-2.5 first:border-l-0",
                compact ? "py-1.5" : "py-2.5",
                isNow && "bg-ice",
                past && "bg-mist",
              )}
              aria-current={isNow ? "time" : undefined}
            >
              <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                <span className={cn("font-display leading-tight font-semibold", compact ? "text-sm" : "text-[15px]", past && "text-muted-foreground")}>
                  {WINDOWS[s.window].name}
                </span>
                {isNow && <StatusChip status="info" size="sm" icon={Clock} label="Now" className="h-5 px-1.5 text-[11px]" />}
              </span>
              <span className="text-xs text-muted-foreground tabular">{fmtSpan(s.to - s.from)}</span>
              {!compact && (
                <ul className={cn("mt-0.5 flex flex-col gap-0.5 text-[13px] leading-snug", past && "text-muted-foreground")}>
                  {own.map((r) => (
                    <li key={r} className="flex gap-1.5">
                      <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-sky" aria-hidden="true" />
                      <span className="min-w-0">{r}</span>
                    </li>
                  ))}
                  {tail && <li className="text-xs text-muted-foreground">{tail}</li>}
                </ul>
              )}
            </li>
          )
        })}
      </ol>
      <Marks cutoffX={cutoffX} />
    </div>
  )
}

interface EventsRowProps {
  events: ChangeEvent[]
  segs: Segment[]
  selectedId?: string | null
  onSelect?: (id: string) => void
  cutoffX: number
  nowX: number | null
}

function EventsRow({ events, segs, selectedId, onSelect, cutoffX, nowX }: EventsRowProps) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const rows = numbered(events)
  const xs = rows.map((e) => xOf(e.at, segs))
  const lanes = stackLanes(xs, width > 0 ? (DOT_PX / width) * 100 : DOT_GAP)
  const height = 18 + (Math.max(0, ...lanes) + 1) * LANE_PX
  return (
    <div ref={ref} className="relative" style={{ height }}>
      <Marks cutoffX={cutoffX} nowX={nowX} />
      {rows.map((e, i) => {
        const o = outcomeOf(e, "ours")
        const Icon = STATUS_ICON[o.status]
        const selected = e.id === selectedId
        const who = e.seat ?? "—"
        return (
          <div
            key={e.id}
            className="absolute bottom-0 z-20 flex -translate-x-1/2 flex-col items-center animate-arrive"
            style={{ left: `${xs[i]}%` }}
          >
            <button
              type="button"
              onClick={onSelect ? () => onSelect(e.id) : undefined}
              disabled={!onSelect}
              title={`#${e.n} ${who} ${e.name ?? ""} · ${CHANNELS[e.channel].label} · ${KINDS[e.kind]} · ${RUNGS[e.decision.rung].label} · ${o.label}`}
              aria-label={`Change ${e.n}: ${who} ${e.name ?? ""}, ${RUNGS[e.decision.rung].label}, ${o.label}`}
              aria-pressed={onSelect ? selected : undefined}
              className={cn(
                "inline-flex h-7 items-center gap-1 rounded-full border px-2 text-xs font-semibold whitespace-nowrap tabular transition-shadow duration-150 disabled:cursor-default",
                STATUS_TONE[o.status],
                onSelect && "cursor-pointer hover:ring-2 hover:ring-blue/40",
                selected && "ring-2 ring-blue ring-offset-1 ring-offset-card",
              )}
            >
              <Icon className="size-3.5" aria-hidden="true" />
              {who}
            </button>
            <span className="w-px bg-grey/50" style={{ height: 6 + lanes[i] * LANE_PX }} aria-hidden="true" />
          </div>
        )
      })}
    </div>
  )
}

interface AxisProps {
  segs: Segment[]
  f: Flight
  nowX: number | null
  now: Date | null
  compact: boolean
}

function Axis({ segs, f, nowX, now, compact }: AxisProps) {
  const ticks = [
    { name: "T-48 h", at: new Date(segs[0].from).toISOString(), zone: "IST" as const, date: true },
    { name: "Cutoff", at: f.special_meal_cutoff, zone: "IST" as const, date: true },
    { name: "Final list", at: f.caterer_final_list_at, zone: "IST" as const, date: true },
    { name: "Dispatch", at: f.dispatch_at, zone: "IST" as const, date: false },
    { name: "Boarding", at: f.boarding_at, zone: "IST" as const, date: false },
    { name: "Departure", at: f.std, zone: "IST" as const, date: false },
    { name: "Landing", at: f.sta, zone: "JST" as const, date: false },
  ]
  return (
    <div className={cn("relative", compact ? "h-10" : "h-12")}>
      <span className="absolute inset-x-0 top-0 h-0.5 bg-navy/70" aria-hidden="true" />
      {ticks.map((t, i) => {
        const x = i === ticks.length - 1 ? 100 : segmentStart(segs, i)
        const align = i === 0 ? "translate-x-0 items-start" : i === ticks.length - 1 ? "-translate-x-full items-end" : "-translate-x-1/2 items-center"
        return (
          <span key={t.name} className={cn("absolute top-0 flex flex-col pt-2 leading-tight", align)} style={{ left: `${x}%` }}>
            <span
              className={cn(
                "absolute top-0 bg-navy",
                i === 1 ? "h-2.5 w-[3px] -translate-x-1/2" : "h-2 w-px",
                i === 0 ? "left-0" : i === ticks.length - 1 ? "right-0" : "left-1/2",
              )}
              aria-hidden="true"
            />
            <span className={cn("font-medium whitespace-nowrap", compact ? "text-[11px]" : "text-xs")}>{t.name}</span>
            {!(compact && i === 0) && (
              <span className="text-[11px] whitespace-nowrap text-muted-foreground tabular">{fmtTime(t.at, t.zone, { date: t.date && !compact })}</span>
            )}
          </span>
        )
      })}
      {nowX != null && now && (
        <span
          className="absolute -top-2.5 z-20 -translate-x-1/2 rounded-full bg-blue px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap text-primary-foreground tabular"
          style={{ left: `${Math.min(97, Math.max(3, nowX))}%` }}
        >
          Now {fmtTime(now, "IST", { zone: false })}
        </span>
      )}
    </div>
  )
}

function Touchpoints({ cols }: { cols: string }) {
  return (
    <div className="grid pt-1.5" style={{ gridTemplateColumns: cols }} aria-label="The brief's four touchpoints">
      {TOUCHPOINTS.map((tp) => (
        <span
          key={tp.id}
          className={cn(
            "mx-0.5 truncate rounded-md px-2 py-1 text-center text-xs font-semibold",
            tp.id === "before" ? "bg-muted text-muted-foreground" : "bg-ice text-navy",
          )}
          style={{ gridColumn: `span ${tp.windows.length}` }}
        >
          {tp.label}
        </span>
      ))}
    </div>
  )
}
