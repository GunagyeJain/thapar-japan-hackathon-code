// Allergy told on board: every food item still on board for a seat, checked offline with the same rules engine.
// An allergy never gets a "safe" answer: an item contains the allergen (red), lists none of it (amber: read the
// label with the passenger), or its ingredients aren't known (grey).
import { evaluate, loadRules, specTags, type PickerGroup } from "@/lib/rules"
import type { CrewPackage } from "@/lib/offline/types"
import type { MealItem, MealSpec, Passenger } from "@/lib/types"
import type { Bilingual } from "@/modules/m8-crew/i18n"

export type AllergyState = "contains" | "not_listed" | "unknown"
/** Sealed, labelled items first (the universal plate), then special and spare trays, then the main menu. */
export type ItemGroup = "sealed" | "spare" | "main"

export interface AllergyRow {
  spec_id: string
  spec: MealSpec | undefined
  group: ItemGroup
  /** The seat's own tray. */
  own: boolean
  count: number
  state: AllergyState
  /** The told allergen groups this dish contains. */
  found: string[]
}

const GROUP_ORDER: Record<ItemGroup, number> = { sealed: 0, spare: 1, main: 2 }
const ON_BOARD: ReadonlySet<MealItem["status"]> = new Set(["planned", "loaded"])

/** Japan's 28 labelled allergens as the shared picker groups (milk covers all dairy), the mandatory ones first. */
export function allergenGroups(): PickerGroup[] {
  const groups = loadRules().pickerGroups.filter((g) => g.kind === "allergen")
  return [...groups.filter((g) => g.jp_class === "mandatory"), ...groups.filter((g) => g.jp_class !== "mandatory")]
}

const groupById = (): Map<string, PickerGroup> => new Map(allergenGroups().map((g) => [g.id, g]))

/** "Peanut, Milk" / "落花生・乳" for the crew's two languages. */
export function allergenNames(groupIds: readonly string[]): Bilingual {
  const groups = groupById()
  const picked = groupIds.map((id) => groups.get(id)).filter((g): g is PickerGroup => g !== undefined)
  return { ja: picked.map((g) => g.labels.ja ?? g.labels.en).join("・"), en: picked.map((g) => g.labels.en).join(", ") }
}

// Same split as the server's inventory.menu_cabin: C for the business menu, Y for economy, null for any cabin.
function menuCabin(specId: string): Passenger["cabin"] | null {
  if (specId.startsWith("SPEC-C-")) return "C"
  if (specId.startsWith("SPEC-Y-")) return "Y"
  return null
}

function groupOf(item: MealItem): ItemGroup {
  if (item.kind === "backup") return "sealed"
  if (item.kind === "main") return "main"
  return "spare"
}

/** One dish against the told allergen groups. No spec or no ingredient list is unknown, never "no allergen". */
export function allergyState(spec: MealSpec | undefined, groupIds: readonly string[]): { state: AllergyState; found: string[] } {
  if (!spec || spec.tags.length === 0) return { state: "unknown", found: [] }
  const groups = groupIds.map((id) => groupById().get(id)).filter((g): g is PickerGroup => g !== undefined)
  const result = evaluate(groups.flatMap((g) => g.tags), specTags(spec.tags, spec.certified))
  if (result.verdict === "UNSAFE") {
    const hit = new Set(result.fired.filter((f) => f.effect === "UNSAFE").map((f) => f.tag))
    return { state: "contains", found: groups.filter((g) => g.tags.some((t) => hit.has(t))).map((g) => g.id) }
  }
  if (result.verdict === "NEEDS_HUMAN") return { state: "unknown", found: [] }
  return { state: "not_listed", found: [] }
}

/** Every dish still on board that this seat could be handed: its own tray and anything not held for someone else. */
export function allergyRows(pkg: CrewPackage, pax: Passenger, groupIds: readonly string[]): AllergyRow[] {
  const specs = new Map(pkg.specs.map((s) => [s.id, s]))
  const rows = new Map<string, AllergyRow>()
  for (const item of pkg.items) {
    if (!ON_BOARD.has(item.status)) continue
    if (item.assigned_passenger_id !== null && item.assigned_passenger_id !== pax.id) continue
    if ((menuCabin(item.spec_id) ?? pax.cabin) !== pax.cabin) continue
    const own = item.assigned_passenger_id === pax.id
    const key = `${own}:${groupOf(item)}:${item.spec_id}`
    const prev = rows.get(key)
    if (prev) {
      rows.set(key, { ...prev, count: prev.count + 1 })
      continue
    }
    const spec = specs.get(item.spec_id)
    rows.set(key, { spec_id: item.spec_id, spec, group: groupOf(item), own, count: 1, ...allergyState(spec, groupIds) })
  }
  return [...rows.values()].sort((a, b) => GROUP_ORDER[a.group] - GROUP_ORDER[b.group] || Number(b.own) - Number(a.own))
}
