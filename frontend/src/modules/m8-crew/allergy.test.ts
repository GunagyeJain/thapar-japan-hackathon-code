import { describe, expect, it } from "vitest"

import specsJson from "@shared/seed/meal_specs.json"
import type { CrewPackage } from "@/lib/offline/types"
import type { MealItem, MealSpec, Passenger } from "@/lib/types"
import { allergenTags, allergyRows } from "@/modules/m8-crew/allergy"

const specs = specsJson as MealSpec[]
const item = (id: string, spec_id: string, kind: MealItem["kind"], pid: string | null = null, status: MealItem["status"] = "loaded"): MealItem => ({
  id,
  flight_id: "JL740-20261025",
  spec_id,
  kind,
  galley: "G2",
  position: "G2-01",
  assigned_passenger_id: pid,
  status,
})
const pax = { id: "PX-30C", seat: "30C", cabin: "Y" } as Passenger
const pkg = (items: MealItem[]): CrewPackage => ({ items, specs }) as unknown as CrewPackage

describe("allergy told on board", () => {
  const board = pkg([
    item("TB-0001", "SPEC-AVML-VRAT", "special", "PX-30C"), // sabudana khichdi: peanut
    item("TB-0002", "SPEC-BACKUP", "backup"),
    item("TB-0003", "SPEC-BACKUP", "backup"),
    item("TB-0004", "SPEC-Y-PANEER", "main"),
    item("TB-0005", "SPEC-C-JAIN", "main"), // business menu: not offered in economy
    item("TB-0006", "SPEC-VJML", "special", "PX-OTHER"), // someone else's tray
    item("TB-0007", "SPEC-UNKNOWN", "spare"), // no spec on board
    item("TB-0008", "SPEC-AVML", "spare", null, "served"),
  ])

  it("lists Japan's 28 labelled allergens, peanut among them", () => {
    expect(allergenTags()).toHaveLength(28)
    expect(allergenTags()).toContain("peanut")
  })

  it("marks peanut red, an unknown item grey, and never answers safe", () => {
    const rows = allergyRows(board, pax, ["peanut"])
    const by = new Map(rows.map((r) => [r.spec_id, r]))
    expect(by.get("SPEC-AVML-VRAT")).toMatchObject({ state: "contains", found: ["peanut"], own: true })
    expect(by.get("SPEC-UNKNOWN")?.state).toBe("unknown")
    expect(by.get("SPEC-BACKUP")).toMatchObject({ state: "not_listed", count: 2 })
    expect(rows.every((r) => ["contains", "not_listed", "unknown"].includes(r.state))).toBe(true)
    expect(rows.some((r) => (r.state as string) === "safe")).toBe(false)
  })

  it("offers only what is on board for this seat, sealed items first, then trays, then the main menu", () => {
    const rows = allergyRows(board, pax, ["peanut"])
    expect(rows.map((r) => r.spec_id)).toEqual(["SPEC-BACKUP", "SPEC-AVML-VRAT", "SPEC-UNKNOWN", "SPEC-Y-PANEER"])
  })

  it("treats a dish with no ingredient list as unknown", () => {
    const blank = { ...pkg([item("TB-0009", "SPEC-BLANK", "spare")]), specs: [{ ...specs[0], id: "SPEC-BLANK", tags: [] }] } as CrewPackage
    expect(allergyRows(blank, pax, ["peanut"])[0]?.state).toBe("unknown")
  })
})
