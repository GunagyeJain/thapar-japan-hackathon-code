// The cutoff ladder's geometry on JL740's own milestones (shared/seed/flight.json).
import flight from "@shared/seed/flight.json"
import { describe, expect, it } from "vitest"

import { fmtSpan, HOUR_MS, ladderSegments, segmentStart, stackLanes, windowAt, xOf } from "./ladder"

const segs = ladderSegments(flight)

describe("ladder segments", () => {
  it("runs from T-48 h to landing in the six windows", () => {
    expect(segs.map((s) => s.window)).toEqual(["ssr", "caterer_list", "standby_uplift", "airport", "onboard", "inflight"])
    expect(segs[0].from).toBe(Date.parse(flight.std) - 48 * HOUR_MS)
    expect(segs[0].to).toBe(Date.parse(flight.special_meal_cutoff))
    expect(segs[5].to).toBe(Date.parse(flight.sta))
  })

  it("clamps a milestone that moved out of order", () => {
    const late = ladderSegments({ ...flight, dispatch_at: "2026-10-25T00:00:00+05:30" })
    expect(late[2].to).toBe(late[2].from)
    expect(late.every((s) => s.to >= s.from)).toBe(true)
  })
})

describe("time to x", () => {
  it("puts the ends at 0 and 100 and clamps outside", () => {
    expect(xOf(segs[0].from, segs)).toBe(0)
    expect(xOf(flight.sta, segs)).toBe(100)
    expect(xOf("2026-10-20T00:00:00+05:30", segs)).toBe(0)
    expect(xOf("2026-10-26T00:00:00+05:30", segs)).toBe(100)
  })

  it("puts every milestone on its window boundary", () => {
    const milestones = [flight.special_meal_cutoff, flight.caterer_final_list_at, flight.dispatch_at, flight.boarding_at, flight.std]
    milestones.forEach((m, i) => expect(xOf(m, segs)).toBeCloseTo(segmentStart(segs, i + 1), 6))
  })

  it("is linear inside a window and keeps time order", () => {
    const mid = (segs[1].from + segs[1].to) / 2
    expect(xOf(mid, segs)).toBeCloseTo((segmentStart(segs, 1) + segmentStart(segs, 2)) / 2, 6)
    const times = ["2026-10-24T11:30:00+05:30", "2026-10-24T23:02:00+05:30", "2026-10-25T01:10:00+05:30", "2026-10-25T02:50:00+05:30", "2026-10-25T06:30:00+05:30"]
    const xs = times.map((t) => xOf(t, segs))
    expect([...xs].sort((a, b) => a - b)).toEqual(xs)
  })

  it("gives the short late windows room to read", () => {
    const width = (i: number) => segmentStart(segs, i + 1) - segmentStart(segs, i)
    // dispatch → boarding is 90 minutes of a 55-hour ladder, but gets more than a tenth of the width
    expect(width(3)).toBeGreaterThan(10)
  })
})

describe("window of a timestamp", () => {
  it("matches the v2 table for the chaos events", () => {
    expect(windowAt("2026-10-23T20:00:00+05:30", segs)).toBe("ssr")
    expect(windowAt("2026-10-24T11:30:00+05:30", segs)).toBe("caterer_list")
    expect(windowAt("2026-10-24T23:02:00+05:30", segs)).toBe("caterer_list")
    expect(windowAt("2026-10-25T01:10:00+05:30", segs)).toBe("standby_uplift")
    expect(windowAt("2026-10-25T02:50:00+05:30", segs)).toBe("airport")
    expect(windowAt("2026-10-25T03:50:00+05:30", segs)).toBe("onboard")
    expect(windowAt("2026-10-25T06:10:00+05:30", segs)).toBe("inflight")
  })

  it("starts the next window exactly at the milestone", () => {
    expect(windowAt(flight.special_meal_cutoff, segs)).toBe("caterer_list")
    expect(windowAt(flight.std, segs)).toBe("inflight")
    expect(windowAt("2026-10-20T00:00:00+05:30", segs)).toBe("ssr")
    expect(windowAt("2026-10-26T00:00:00+05:30", segs)).toBe("inflight")
  })
})

describe("dot lanes", () => {
  it("stacks dots that would overlap and keeps the others on lane 0", () => {
    expect(stackLanes([10, 50, 90], 3)).toEqual([0, 0, 0])
    expect(stackLanes([80, 81, 82, 20], 3)).toEqual([0, 1, 2, 0])
    expect(stackLanes([81, 80], 3)).toEqual([1, 0])
  })
})

describe("span labels", () => {
  it("reads hours and minutes", () => {
    expect(fmtSpan(23 * HOUR_MS)).toBe("23 h")
    expect(fmtSpan(21 * HOUR_MS + 5 * 60_000)).toBe("21 h 05 m")
    expect(fmtSpan(85 * 60_000)).toBe("1 h 25 m")
    expect(fmtSpan(45 * 60_000)).toBe("45 m")
  })
})
