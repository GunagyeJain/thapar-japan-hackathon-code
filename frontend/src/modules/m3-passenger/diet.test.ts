import { describe, expect, it } from "vitest"

import { loadRules } from "@/lib/rules"
import type { DietValue } from "./types"
import { EMPTY_DIET, isGroupOn, pickerGroups, summaryChips, toggleAllergen, toggleGroup, togglePreset, toRequest } from "./diet"
import { pick } from "./i18n"

const preset = (id: string) => loadRules().presets.get(id)!
const group = (id: string) => loadRules().pickerGroups.find((g) => g.id === id)!
const ticked = (v: DietValue) => pickerGroups("diet").filter((g) => isGroupOn(v, g)).map((g) => g.id)
const tap = (...ids: string[]) => ids.reduce((v, id) => togglePreset(v, preset(id)), EMPTY_DIET)
const en = (v: DietValue) => summaryChips(v).map((c) => pick(c.text, "en"))

describe("DietPicker state", () => {
  it("Jain ticks meat, fish, egg, onion/garlic, root vegetables and honey", () => {
    const v = tap("jain")
    expect(ticked(v)).toEqual(["meat", "seafood", "egg", "onion_garlic", "root_veg", "honey", "alcohol"])
    expect(v.allow).toEqual(["dairy"])
  })

  it("unticking onion & garlic under Jain keeps the rest of the onion family", () => {
    const v = toggleGroup(tap("jain"), group("onion_garlic"))
    expect(ticked(v)).not.toContain("onion_garlic")
    expect(v.forbid).not.toContain("allium")
    expect(v.forbid).toEqual(expect.arrayContaining(["leek", "shallot", "spring_onion", "chive"]))
    expect(v.forbid).not.toContain("onion")
    expect(v.presets).toEqual(["jain"])
  })

  it("unticking then ticking a group comes back to the same boxes", () => {
    const v = toggleGroup(toggleGroup(tap("jain"), group("honey")), group("honey"))
    expect(ticked(v)).toEqual(ticked(tap("jain")))
  })

  it("tapping a preset again takes back only its own tags", () => {
    const v = togglePreset(tap("vegetarian", "no_onion_garlic"), preset("no_onion_garlic"))
    expect(ticked(v)).toEqual(["meat", "seafood", "egg"])
    expect(v.presets).toEqual(["vegetarian"])
  })

  it("vegan off brings back dairy OK from vegetarian", () => {
    const both = tap("vegetarian", "vegan")
    expect(both.allow).not.toContain("dairy")
    const v = togglePreset(both, preset("vegan"))
    expect(v.forbid).not.toContain("dairy")
    expect(v.allow).toContain("dairy")
  })

  it("ticking dairy removes it from allow", () => {
    expect(toggleGroup(tap("vegetarian"), group("dairy")).allow).not.toContain("dairy")
  })

  it("allergies are kept apart but sent as forbidden too", () => {
    const v = toggleAllergen(tap("vegetarian"), group("allergen_peanut"))
    expect(ticked(v)).not.toContain("peanut")
    const req = toRequest(v)
    expect(req.allergens).toEqual(["peanut"])
    expect(req.forbid).toContain("peanut")
  })
})

describe("DietSummary chips", () => {
  it("Priya: vegetarian + no onion or garlic", () => {
    const v = tap("vegetarian", "no_onion_garlic")
    expect(en(v).join(" · ")).toBe("No meat, fish, egg · No onion or garlic · Also no gelatin · Dairy OK")
    expect(pick(summaryChips(v)[0].text, "ja")).toBe("肉・魚・卵なし")
    expect(pick(summaryChips(v)[0].text, "hi")).toBe("मांस, मछली, अंडा नहीं")
  })

  it("Jain mentions mushrooms but not the onion family twice", () => {
    expect(en(tap("jain"))).toEqual([
      "No meat, fish, egg",
      "No onion or garlic",
      "No root vegetables",
      "No honey",
      "No alcohol",
      "Also no mushrooms, gelatin",
      "Dairy OK",
    ])
  })

  it("allergies get their own chip", () => {
    const v = toggleAllergen(toggleAllergen(EMPTY_DIET, group("allergen_peanut")), group("allergen_sesame"))
    expect(en(v)).toEqual(["Allergy: Peanut, Sesame"])
  })
})
