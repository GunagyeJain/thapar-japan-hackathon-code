import { describe, expect, it } from "vitest"

import type { Notification } from "@/lib/types"

import { answeredQuestions, radarQuestion, strictest, tierFor } from "./thread"

const note = (id: string, at: string, ref: Record<string, unknown> = {}): Notification => ({
  id,
  channel: "whatsapp",
  to: "PX-0057",
  lang: "en",
  title: "Meal check · JL740",
  body: "…",
  at,
  ref,
})

describe("tiers", () => {
  it("ports service.tier_for", () => {
    expect(tierFor("garlic")).toBe("hard")
    expect(tierFor("jaggery")).toBe("firm")
    expect(tierFor("mushroom")).toBe("hard")
    expect(tierFor("tomato")).toBe("soft")
    expect(tierFor("tomato", ["tomato"])).toBe("hard")
  })

  it("finds the strictest tier", () => {
    expect(strictest({ tiers: { tomato: "soft", jaggery: "firm" } })).toBe("firm")
    expect(strictest({ tiers: {} })).toBeNull()
  })
})

describe("the Calendar Radar", () => {
  it("reads Radar questions and the answers already given", () => {
    const q = note("q", "2026-10-23T18:01:00+05:30", { kind: "radar_question", question_id: "RQ-1", options: [{ id: "yes", label: { en: "Yes" } }] })
    const a = note("a", "2026-10-23T18:02:00+05:30", { kind: "radar_answer", question_id: "RQ-1", option_id: "yes" })
    expect(radarQuestion(q)?.question_id).toBe("RQ-1")
    expect(radarQuestion(a)).toBeNull()
    expect(answeredQuestions([q, a]).get("RQ-1")).toBe("yes")
  })
})
