import { describe, expect, it } from "vitest"

import { isOpen, mealChoices, mealDeadlines } from "./deadlines"

const JL740 = { std: "2026-10-25T04:35:00+05:30", special_meal_cutoff: "2026-10-24T03:35:00+05:30" }

describe("JAL special-meal deadlines", () => {
  it("keeps the flight's 25 h cutoff and counts the 49 h line back from departure", () => {
    const [standard, longLead] = mealDeadlines(JL740)
    expect(standard).toMatchObject({ id: "standard", at: JL740.special_meal_cutoff, hours: 25, phoneHours: 24 })
    expect(longLead).toMatchObject({ id: "long_lead", hours: 49, phoneHours: 48 })
    expect(new Date(longLead.at).getTime()).toBe(new Date("2026-10-23T03:35:00+05:30").getTime())
  })

  it("is closed at the deadline and while the clock is unknown", () => {
    const at = JL740.special_meal_cutoff
    expect(isOpen(at, new Date("2026-10-23T18:00:00+05:30"))).toBe(true)
    expect(isOpen(at, new Date(at))).toBe(false)
    expect(isOpen(at, null)).toBe(false)
  })

  it("lists every JAL code once, then kosher and minimal-allergen on the 49 h line", () => {
    const choices = mealChoices()
    expect(new Set(choices.map((c) => c.id)).size).toBe(choices.length)
    expect(choices.find((c) => c.code === "AVML")?.deadline).toBe("standard")
    expect(choices.filter((c) => c.deadline === "long_lead").map((c) => c.id)).toEqual(["KSML", "minimal-allergen"])
  })
})
