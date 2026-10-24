// Geometry of the cutoff ladder: one flight from T-48 h to landing, cut into the six time windows.
// The late windows last minutes, not hours, so time is drawn piecewise: linear inside each window,
// every window wide enough to read. No React here, so it is easy to test.
import type { Flight } from "@/lib/types"

import { WINDOW_ORDER } from "./labels"
import type { Window } from "./types"

export const HOUR_MS = 3_600_000
const MINUTE_MS = 60_000
/** The ladder starts this many hours before departure. */
export const LEAD_HOURS = 48

/** Reading width of each window (relative). */
export const WINDOW_WEIGHT: Record<Window, number> = {
  ssr: 1.45,
  caterer_list: 1.6,
  standby_uplift: 1.25,
  airport: 1.4,
  onboard: 1.5,
  inflight: 1.5,
}

export type Milestones = Pick<Flight, "special_meal_cutoff" | "caterer_final_list_at" | "dispatch_at" | "boarding_at" | "std" | "sta">

export interface Segment {
  window: Window
  from: number
  to: number
  weight: number
}

const toMs = (t: number | string | Date): number => (typeof t === "number" ? t : new Date(t).getTime())

/** The six windows from the flight's milestones, in order. A milestone that moved out of order is clamped. */
export function ladderSegments(f: Milestones): Segment[] {
  const std = toMs(f.std)
  const raw = [std - LEAD_HOURS * HOUR_MS, f.special_meal_cutoff, f.caterer_final_list_at, f.dispatch_at, f.boarding_at, f.std, f.sta].map(toMs)
  const bounds = raw.reduce<number[]>((acc, b) => [...acc, acc.length ? Math.max(b, acc[acc.length - 1]) : b], [])
  return WINDOW_ORDER.map((window, i) => ({ window, from: bounds[i], to: bounds[i + 1], weight: WINDOW_WEIGHT[window] }))
}

function totalWeight(segs: Segment[]): number {
  return segs.reduce((sum, s) => sum + s.weight, 0)
}

/** Left edge of segment `i`, in percent of the ladder width. */
export function segmentStart(segs: Segment[], i: number): number {
  const total = totalWeight(segs)
  return total ? (segs.slice(0, i).reduce((sum, s) => sum + s.weight, 0) / total) * 100 : 0
}

/** Where a moment sits on the ladder, in percent (0 at T-48 h, 100 at landing; clamped outside). */
export function xOf(t: number | string | Date, segs: Segment[]): number {
  if (!segs.length) return 0
  const ms = toMs(t)
  if (ms <= segs[0].from) return 0
  if (ms >= segs[segs.length - 1].to) return 100
  const total = totalWeight(segs)
  let left = 0
  for (const s of segs) {
    if (ms < s.to) {
      const span = s.to - s.from
      const inside = span > 0 ? (ms - s.from) / span : 0
      return ((left + inside * s.weight) / total) * 100
    }
    left += s.weight
  }
  return 100
}

/** The window a moment falls in: before the ladder starts it is still `ssr`, after landing `inflight`. */
export function windowAt(t: number | string | Date, segs: Segment[]): Window {
  const ms = toMs(t)
  return segs.find((s) => ms < s.to)?.window ?? "inflight"
}

/**
 * Stack dots that would overlap: each x (percent) gets the lowest lane whose last dot is at least `minGap` away.
 * Returns one lane index per input, in input order.
 */
export function stackLanes(xs: number[], minGap: number): number[] {
  const order = xs.map((x, i) => ({ x, i })).sort((a, b) => a.x - b.x || a.i - b.i)
  const laneEnds: number[] = []
  const lanes = new Array<number>(xs.length).fill(0)
  for (const { x, i } of order) {
    const free = laneEnds.findIndex((end) => x - end >= minGap)
    const lane = free === -1 ? laneEnds.length : free
    laneEnds[lane] = x
    lanes[i] = lane
  }
  return lanes
}

/** "23 h", "21 h 05 m", "1 h 25 m", "45 m". */
export function fmtSpan(ms: number): string {
  const totalMin = Math.max(0, Math.round(ms / MINUTE_MS))
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h === 0) return `${m} m`
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, "0")} m`
}

/** The brief's four touchpoints, laid over the windows they cover. */
export const TOUCHPOINTS: { id: string; label: string; windows: Window[] }[] = [
  { id: "before", label: "Before journey", windows: ["ssr", "caterer_list"] },
  { id: "airport", label: "Airport", windows: ["standby_uplift", "airport"] },
  { id: "boarding", label: "Boarding", windows: ["onboard"] },
  { id: "inflight", label: "In-flight", windows: ["inflight"] },
]
