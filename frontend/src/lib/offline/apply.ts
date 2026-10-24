// Applies a crew event to the local package, the same way the server will, so the tablet is right offline.
import type { CrewEvent, CrewPackage } from "@/lib/offline/types"
import type { MealItem } from "@/lib/types"

function withItem(pkg: CrewPackage, id: string, change: Partial<MealItem>): MealItem[] {
  return pkg.items.map((i) => (i.id === id ? { ...i, ...change } : i))
}

export function applyLocal(pkg: CrewPackage, ev: CrewEvent): CrewPackage {
  switch (ev.type) {
    case "galley_found":
      return { ...pkg, items: withItem(pkg, ev.item_id, { status: "loaded" }) }
    case "galley_missing":
      return { ...pkg, items: withItem(pkg, ev.item_id, { status: "missing" }) }
    case "swap_backup": {
      const pid = ev.passenger_id
      const items = pkg.items.map((i) => {
        if (i.id === ev.item_id) return { ...i, assigned_passenger_id: pid ?? null, status: "loaded" as const }
        if (i.kind === "special" && i.assigned_passenger_id === pid) return { ...i, status: "missing" as const }
        return i
      })
      return { ...pkg, items }
    }
    case "seat_scan":
      return ev.verdict === "SAFE" ? { ...pkg, items: withItem(pkg, ev.item_id, { status: "served" }) } : pkg
  }
}
