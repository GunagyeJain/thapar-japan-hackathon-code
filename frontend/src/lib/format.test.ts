import { describe, expect, it } from "vitest"

import { fmtDuration, fmtTime } from "@/lib/format"
import { t } from "@/lib/i18n"

describe("fmtTime", () => {
  it("shows departure and arrival in their own zones", () => {
    expect(fmtTime("2026-10-25T04:35:00+05:30", "IST")).toBe("04:35 IST")
    expect(fmtTime("2026-10-25T15:20:00+09:00", "JST")).toBe("15:20 JST")
    expect(fmtTime("2026-10-25T00:40:00+05:30", "JST")).toBe("04:10 JST")
  })
})

describe("fmtDuration", () => {
  it("formats countdowns", () => {
    expect(fmtDuration((60 + 38) * 60_000)).toBe("1 h 38 m")
    expect(fmtDuration(12 * 60_000 + 5_000)).toBe("12 m 05 s")
    expect(fmtDuration((30 * 60 + 40) * 60_000 + 7_000, { seconds: true })).toBe("30 h 40 m 07 s")
    expect(fmtDuration(-1)).toBe("0 s")
  })
})

describe("t", () => {
  it("falls back to English", () => {
    expect(t({ en: "Meal", ja: "食事" }, "ja")).toBe("食事")
    expect(t({ en: "Meal" }, "hi")).toBe("Meal")
  })
})
