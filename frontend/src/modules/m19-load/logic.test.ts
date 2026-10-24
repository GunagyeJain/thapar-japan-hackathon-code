import { describe, expect, it } from "vitest"

import { axisMax, barPct, cellFor, coverLabel, failReasons, fmtInr, fmtPct, splitName } from "./logic"

describe("m19 load helpers", () => {
  it("shows every verdict as a mark and a word", () => {
    expect(cellFor("SAFE")).toMatchObject({ status: "safe", word: "Safe" })
    expect(cellFor("UNSAFE")).toMatchObject({ status: "unsafe", word: "No" })
    expect(cellFor("NEEDS_HUMAN")).toMatchObject({ status: "warn", word: "Check" })
  })

  it("labels coverage, with checks when some cells need a person", () => {
    expect(coverLabel(13, 13)).toBe("13 of 13")
    expect(coverLabel(4, 13, 1)).toBe("4 of 13 (+1 to check)")
  })

  it("scales bars to the biggest demand and clips the rest", () => {
    const max = axisMax([
      { p90: 39, forecast: 31.1 },
      { p90: 62, forecast: 44.3 },
    ])
    expect(max).toBe(80)
    expect(barPct(40, max)).toBe(50)
    expect(barPct(120, max)).toBe(100)
    expect(barPct(0, max)).toBe(0)
  })

  it("formats money and shares", () => {
    expect(fmtInr(35000)).toBe("₹35,000")
    expect(fmtPct(0.98731)).toBe("98.7%")
    expect(fmtPct(0.99943)).toBe("99.94%")
  })

  it("splits a dish name into title and contents", () => {
    expect(splitName("Universal plate (retort, shelf-stable): samak millet, makhana, lauki")).toEqual([
      "Universal plate (retort, shelf-stable)",
      "samak millet, makhana, lauki",
    ])
    expect(splitName("Jain thali with dairy")).toEqual(["Jain thali with dairy", null])
  })

  it("names each forbidden family once", () => {
    expect(failReasons([{ tag: "dairy" }, { tag: "dairy" }, { tag: "root_veg" }])).toEqual(["dairy", "root veg"])
  })
})
