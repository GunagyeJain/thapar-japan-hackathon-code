import { describe, expect, it } from "vitest"

import { dietOf, formRules, SPECIAL_DAYS, specialDaysOf } from "./specialDays"

describe("special days on the meal form", () => {
  it("turns a fast into dates the Radar asks about, and a veg weekday into a weekday rule", () => {
    const rules = formRules({ forbid: ["meat", "onion"], allow: ["dairy"], allergens: [] }, ["purnima", "veg_tuesday"])
    const [purnima, tuesday] = rules.time_rules
    expect(purnima).toMatchObject({ kind: "dates", preset: "vrat", confirm: true })
    expect(purnima.dates).toContain("2026-10-25") // Sharad Purnima, JL740's date
    expect(tuesday).toEqual({ id: "TR-veg_tuesday", kind: "weekday", weekdays: [1], preset: "vegetarian" })
    expect(rules).toMatchObject({ forbid: ["meat", "onion"], allow: ["dairy"], flex: false })
  })

  it("opens a saved passport with its days and foods ticked, allergies apart", () => {
    const saved = formRules({ forbid: ["egg", "peanut"], allow: [], allergens: ["peanut"] }, ["ekadashi"])
    expect(specialDaysOf(saved)).toEqual(["ekadashi"])
    expect(dietOf(saved)).toEqual({ presets: [], forbid: ["egg"], allow: [], allergens: ["peanut"] })
    expect(specialDaysOf(null)).toEqual([])
  })

  it("offers each day once", () => {
    expect(new Set(SPECIAL_DAYS.map((d) => d.id)).size).toBe(SPECIAL_DAYS.length)
  })
})
