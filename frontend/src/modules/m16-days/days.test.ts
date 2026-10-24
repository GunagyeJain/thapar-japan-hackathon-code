// Same cases as backend/tests/test_m16_days.py, so the phone and the server agree on fast days.
import { describe, expect, it } from "vitest"

import { combinePresets, fastDays, rulesOn } from "@/lib/rules"

const PRIYA = { forbid: ["meat", "seafood", "egg", "onion", "garlic"], allow: ["dairy"] }

describe("fast days", () => {
  it("leaves the rules alone on an ordinary day", () => {
    expect(rulesOn(PRIYA.forbid, PRIYA.allow, ["2026-11-20"], "2026-10-25")).toEqual({ ...PRIYA, fast_day: false })
  })

  it("adds the vrat rules on a fast day", () => {
    const out = rulesOn(PRIYA.forbid, PRIYA.allow, ["2026-11-20"], "2026-11-20")
    expect(out.fast_day).toBe(true)
    expect(out.forbid).toEqual(expect.arrayContaining(["grain", "legume", "alcohol"]))
    expect(out.allow).toEqual(expect.arrayContaining(["dairy", "potato", "peanut", "fruit"]))
  })

  it("keeps forbid winning for a Jain", () => {
    const jain = combinePresets(["jain"])
    expect(rulesOn(jain.forbid, jain.allow, ["2026-11-05"], "2026-11-05").allow).not.toContain("potato")
  })

  it("finds fast days in the calendar", () => {
    expect(fastDays(["ekadashi"], ["2026-10-25", "2026-11-20"])).toEqual(["2026-11-20"])
    expect(fastDays(["navratri"], ["2026-11-20"])).toEqual([])
  })
})
