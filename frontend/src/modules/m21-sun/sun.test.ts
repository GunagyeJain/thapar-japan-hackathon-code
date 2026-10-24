import { describe, expect, it } from "vitest"

import { fmtDeg, fmtLeft, fmtPosition, istHourTicks, niceRange, ruleLabel } from "@/modules/m21-sun/format"

describe("m21 helpers", () => {
  it("counts down in the page language, rounded up to the minute", () => {
    expect(fmtLeft(48 * 60_000, "en")).toBe("48 min")
    expect(fmtLeft(65 * 60_000 + 1, "en")).toBe("1 h 06 m")
    expect(fmtLeft(239 * 60_000, "ja")).toBe("3時間59分")
    expect(fmtLeft(-5_000, "en")).toBe("0 min")
  })

  it("names the rule, not the person", () => {
    expect(ruleLabel({ kind: "daylight", after_sunrise_min: 48 }, "en")).toBe("Daylight only, +48 min")
    expect(ruleLabel({ kind: "daylight", after_sunrise_min: 0 }, "en")).toBe("Daylight only")
    expect(ruleLabel({ kind: "fast_dawn_to_sunset" }, "en")).toBe("Fasts dawn to sunset")
  })

  it("formats degrees and positions", () => {
    expect(fmtDeg(-3.91)).toBe("−3.9°")
    expect(fmtDeg(-0.01)).toBe("0.0°")
    expect(fmtDeg(15, 0)).toBe("15°")
    expect(fmtPosition(31.746, 85.823)).toBe("31.7°N 85.8°E")
  })

  it("puts a tick on every whole IST hour of JL740 (04:35 → 11:50 IST)", () => {
    const ticks = istHourTicks(Date.parse("2026-10-25T04:35:00+05:30"), Date.parse("2026-10-25T15:20:00+09:00"))
    expect(ticks.map((at) => new Date(at).toISOString())).toEqual(
      ["05", "06", "07", "08", "09", "10", "11"].map((h) => new Date(`2026-10-25T${h}:00:00+05:30`).toISOString()),
    )
  })

  it("rounds the elevation axis out to 15°", () => {
    expect(niceRange([-25.3, 47.9, -3.91], 15)).toEqual([-30, 60])
  })
})
