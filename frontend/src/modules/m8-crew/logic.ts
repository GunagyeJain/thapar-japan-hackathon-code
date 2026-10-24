// Offline decisions on the tablet: verdicts, the galley list and the greedy backup pick.
import { evaluate, specTags, type Fired } from "@/lib/rules"
import type { CrewPackage } from "@/lib/offline/types"
import type { MealItem, MealSpec, Passenger, Verdict } from "@/lib/types"

export interface Lookup {
  passengers: Map<string, Passenger>
  bySeat: Map<string, Passenger>
  specs: Map<string, MealSpec>
  items: Map<string, MealItem>
}

export function lookup(pkg: CrewPackage): Lookup {
  return {
    passengers: new Map(pkg.passengers.map((p) => [p.id, p])),
    bySeat: new Map(pkg.passengers.map((p) => [p.seat, p])),
    specs: new Map(pkg.specs.map((s) => [s.id, s])),
    items: new Map(pkg.items.map((i) => [i.id, i])),
  }
}

export interface ItemVerdict {
  verdict: Verdict
  fired: Fired[]
}

/** Server verdict from the package when there is one; the TS engine fills in the reasons (and any gaps). */
export function verdictFor(pkg: CrewPackage, L: Lookup, passengerId: string, item: MealItem): ItemVerdict {
  const rule = pkg.forbid[passengerId]
  if (!rule) return { verdict: "SAFE", fired: [] }
  const spec = L.specs.get(item.spec_id)
  const local = evaluate(rule.forbid, spec ? specTags(spec.tags, spec.certified) : [])
  return { verdict: pkg.verdicts[passengerId]?.[item.id] ?? local.verdict, fired: local.fired }
}

/** "AB12CD", "tb-ab12cd" or "TB-AB12CD" → "TB-AB12CD". */
export function normaliseCode(raw: string): string {
  const code = raw.trim().toUpperCase().replace(/^TB-?/, "")
  return `TB-${code}`
}

export interface GalleyRow {
  item: MealItem
  passenger: Passenger | undefined
  spec: MealSpec | undefined
  /** The backup now assigned to this passenger, after a swap. */
  replacement: MealItem | undefined
}

export const isDone = (r: GalleyRow): boolean =>
  r.item.status === "loaded" || r.item.status === "served" || r.replacement !== undefined

export function galleyRows(pkg: CrewPackage, L: Lookup): Map<string, GalleyRow[]> {
  const rows = new Map<string, GalleyRow[]>()
  for (const id of pkg.expected_specials) {
    const item = L.items.get(id)
    if (!item) continue
    const pid = item.assigned_passenger_id
    const replacement = pkg.items.find((i) => i.id !== id && i.assigned_passenger_id === pid && i.kind !== "special" && i.kind !== "main" && i.status === "loaded")
    const row: GalleyRow = { item, passenger: pid ? L.passengers.get(pid) : undefined, spec: L.specs.get(item.spec_id), replacement }
    rows.set(item.galley, [...(rows.get(item.galley) ?? []), row])
  }
  for (const list of rows.values()) list.sort((a, b) => a.item.position.localeCompare(b.item.position))
  return new Map([...rows.entries()].sort(([a], [b]) => a.localeCompare(b)))
}

const KIND_ORDER: Record<MealItem["kind"], number> = { spare: 0, backup: 1, special: 9, main: 9 }

/** Greedy pick for a missing tray: a free spare special first, then a sealed backup; same galley first; must be SAFE. */
export function pickBackup(pkg: CrewPackage, L: Lookup, passengerId: string, galley: string): MealItem | null {
  const candidates = pkg.items
    .filter((i) => (i.kind === "spare" || i.kind === "backup") && !i.assigned_passenger_id && i.status !== "missing" && i.status !== "served")
    .filter((i) => L.specs.get(i.spec_id)?.kind !== "main")
    .sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || Number(a.galley !== galley) - Number(b.galley !== galley) || a.position.localeCompare(b.position))
  return candidates.find((i) => verdictFor(pkg, L, passengerId, i).verdict === "SAFE") ?? null
}
