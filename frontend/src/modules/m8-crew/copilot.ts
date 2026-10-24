// m20 copilot on the crew tablet: the package's copilot block and the offline decisions built on it.
import type { CrewPackage } from "@/lib/offline/types"
import type { MealItem, Text } from "@/lib/types"

export type Tier = "hard" | "firm" | "soft" | "none"
export type TapType = "eaten" | "refused" | "swapped"
export const TAP_TYPES: readonly TapType[] = ["eaten", "refused", "swapped"]

/** The tray the router (m18) or the meal items put in front of the passenger. */
export interface CopilotTray {
  item_id: string | null
  spec_id: string | null
  spec_name: Text
  /** Which rung put it there: ssr_change, onboard_spare, reserve_pouch, held_main, … */
  rung: string
}

export interface CopilotSeat {
  seat: string
  passenger_id: string
  tier: Tier
  flex: boolean
  card: { ja: string; en: string; hi: string }
  may_eat_from: string | null
  sunrise_box: boolean
  assigned: CopilotTray | null
  /** Any main from the trolley fits their rules: nothing needs holding. */
  any_main: boolean
  galley: "G1" | "G2"
  source?: string
  fast_today?: boolean
  sun_rule?: "daylight" | "dawn_to_sunset"
  may_eat_until?: string | null
  sun_note?: Text | null
  /** Strict or medical, no main fits and no tray is held: crew must find one. */
  needs_tray?: boolean
}

export interface CopilotTap {
  client_id: string
  type: TapType
  passenger_id: string
  seat: string
  item_id: string | null
  at: string
}

export interface Copilot {
  seats: CopilotSeat[]
  serve_order: string[]
  taps: CopilotTap[]
  sources?: { trays: string; sun: string | null }
}

/** The crew package with m20's block (missing in a download made before m20). */
export type CopilotPackage = CrewPackage & { copilot?: Copilot | null }

/** The newest tap per passenger. */
export function lastTaps(copilot: Copilot): Map<string, CopilotTap> {
  const out = new Map<string, CopilotTap>()
  for (const tap of copilot.taps) {
    const seen = out.get(tap.passenger_id)
    if (!seen || seen.at <= tap.at) out.set(tap.passenger_id, tap)
  }
  return out
}

/** Applies a tap to the local package, the way the next download will show it. */
export function withTap(pkg: CopilotPackage, tap: CopilotTap): CopilotPackage {
  if (!pkg.copilot) return pkg
  if (pkg.copilot.taps.some((t) => t.client_id === tap.client_id)) return pkg
  return { ...pkg, copilot: { ...pkg.copilot, taps: [...pkg.copilot.taps, tap] } }
}

/** Special trays (not mains) go through the scan-to-serve check before they are handed over. */
export function needsScan(item: MealItem | undefined): boolean {
  return item !== undefined && item.kind !== "main" && item.status !== "served"
}

/** The rung a tray swapped in on the tablet stands for (same mapping as the server's fallback). */
const RUNG_BY_KIND: Record<MealItem["kind"], string> = {
  special: "ssr_change",
  spare: "onboard_spare",
  backup: "reserve_pouch",
  main: "held_main",
}

export interface SeatTray {
  tray: CopilotTray | null
  item: MealItem | undefined
}

/**
 * The tray for a seat right now. The copilot block is fixed at download; when the galley check swapped a
 * missing tray for a backup on this tablet, the live item in the package wins.
 */
export function trayFor(pkg: CopilotPackage, seat: CopilotSeat): SeatTray {
  const planned = seat.assigned
  const item = planned?.item_id ? pkg.items.find((i) => i.id === planned.item_id) : undefined
  if (item?.status !== "missing") return { tray: planned, item }
  const live = pkg.items.find((i) => i.assigned_passenger_id === seat.passenger_id && i.status !== "missing" && i.id !== item.id)
  if (!live) return { tray: planned, item }
  const spec = pkg.specs.find((s) => s.id === live.spec_id)
  return {
    tray: { item_id: live.id, spec_id: live.spec_id, spec_name: spec?.name ?? { en: live.spec_id }, rung: RUNG_BY_KIND[live.kind] },
    item: live,
  }
}

export interface ServeRow extends SeatTray {
  seat: CopilotSeat
  tap: CopilotTap | undefined
  /** Eaten, or scanned green and handed over. */
  done: boolean
}

/** The serve list: seats in service order, grouped by the galley their tray comes from. */
export function serveRows(pkg: CopilotPackage): Map<string, ServeRow[]> {
  const groups = new Map<string, ServeRow[]>()
  const copilot = pkg.copilot
  if (!copilot) return groups
  const bySeat = new Map(copilot.seats.map((s) => [s.seat, s]))
  const taps = lastTaps(copilot)
  for (const id of copilot.serve_order) {
    const seat = bySeat.get(id)
    if (!seat) continue
    const { tray, item } = trayFor(pkg, seat)
    const tap = taps.get(seat.passenger_id)
    const row: ServeRow = { seat, tray, item, tap, done: tap?.type === "eaten" || item?.status === "served" }
    const galley = item?.galley ?? seat.galley
    groups.set(galley, [...(groups.get(galley) ?? []), row])
  }
  return new Map([...groups.entries()].sort(([a], [b]) => a.localeCompare(b)))
}

/** Seats done out of the serve list, for the task card. */
export function serveProgress(pkg: CopilotPackage): { done: number; of: number } {
  const rows = [...serveRows(pkg).values()].flat()
  return { done: rows.filter((r) => r.done).length, of: rows.length }
}
