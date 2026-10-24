import { describe, expect, it } from "vitest"

import type { Notification } from "@/lib/types"

import {
  answeredQuestions,
  canFlex,
  chatNotes,
  chipsFor,
  freshNotes,
  groupChips,
  parseBooking,
  pickerFromRules,
  radarQuestion,
  rulesFromPicker,
  shareLink,
  tierFor,
} from "./thread"
import type { Chip, Rules } from "./types"

const note = (id: string, at: string, ref: Record<string, unknown> = {}, channel: Notification["channel"] = "whatsapp"): Notification => ({
  id,
  channel,
  to: "PX-0057",
  lang: "en",
  title: "Meal check · JL740",
  body: "…",
  at,
  ref,
})

const PRIYA: Rules = {
  forbid: ["meat", "seafood", "egg", "gelatin", "onion", "garlic"],
  allow: ["dairy"],
  allergens: [],
  tiers: { meat: "hard", seafood: "hard", egg: "hard", gelatin: "hard", onion: "hard", garlic: "hard" },
  flex: false,
  time_rules: [{ id: "TR-1", kind: "dates", dates: ["2026-10-25"], preset: "vrat", confirm: true }],
}

describe("tiers and chips", () => {
  it("ports service.tier_for", () => {
    expect(tierFor("garlic")).toBe("hard")
    expect(tierFor("jaggery")).toBe("firm")
    expect(tierFor("mushroom")).toBe("hard")
    expect(tierFor("tomato")).toBe("soft")
    expect(tierFor("tomato", ["tomato"])).toBe("hard")
  })

  it("groups chips by how strict they are", () => {
    const chips: Chip[] = [
      { tag: "meat", kind: "forbid", tier: "hard", via: "pure veg → vegetarian", source: "dictionary" },
      { tag: "sugar", kind: "forbid", tier: "firm", via: "diabetic", source: "dictionary" },
      { tag: "mushroom", kind: "forbid", tier: "soft", via: "mushrooms → mushroom", source: "dictionary" },
      { tag: "peanut", kind: "allergen", tier: "hard", via: "peanuts → peanut", source: "dictionary" },
      { tag: "dairy", kind: "allow", tier: null, via: "pure veg → vegetarian", source: "dictionary" },
    ]
    const groups = groupChips(chips)
    expect([groups.never, groups.medical, groups.prefer, groups.allergy, groups.fine].map((g) => g.map((c) => c.tag))).toEqual([
      ["meat"], ["sugar"], ["mushroom"], ["peanut"], ["dairy"],
    ])
  })

  it("offers flex only without hard rules", () => {
    expect(canFlex(PRIYA)).toBe(false)
    expect(canFlex({ tiers: { mushroom: "soft" } })).toBe(true)
  })
})

describe("the thread", () => {
  it("keeps WhatsApp messages, oldest first, and only the new ones", () => {
    const notes = [note("b", "2026-10-23T18:05:00+05:30"), note("a", "2026-10-23T18:01:00+05:30"), note("c", "2026-10-23T18:02:00+05:30", {}, "sms")]
    expect(chatNotes(notes).map((n) => n.id)).toEqual(["a", "b"])
    expect(freshNotes(new Set(["a"]), notes).map((n) => n.id)).toEqual(["b"])
  })

  it("reads Radar questions and the answers already given", () => {
    const q = note("q", "2026-10-23T18:01:00+05:30", { kind: "radar_question", question_id: "RQ-1", options: [{ id: "yes", label: { en: "Yes" } }] })
    const a = note("a", "2026-10-23T18:02:00+05:30", { kind: "radar_answer", question_id: "RQ-1", option_id: "yes" })
    expect(radarQuestion(q)?.question_id).toBe("RQ-1")
    expect(radarQuestion(a)).toBeNull()
    expect(answeredQuestions([q, a]).get("RQ-1")).toBe("yes")
  })
})

describe("booking and links", () => {
  it("finds the reference and surname in a message", () => {
    expect(parseBooking("6XK2QP SHARMA")).toEqual({ pnr: "6XK2QP", surname: "SHARMA" })
    expect(parseBooking("sharma, 6xk2qp")).toEqual({ pnr: "6XK2QP", surname: "SHARMA" })
    expect(parseBooking("PNR LZBWLZ surname Jain")).toEqual({ pnr: "LZBWLZ", surname: "JAIN" })
    expect(parseBooking("no onion please")).toBeNull()
  })

  it("builds the link a companion opens", () => {
    expect(shareLink("https://x.test", "LM39H6", "KUMAR")).toBe("https://x.test/chat?pnr=LM39H6&surname=KUMAR")
  })
})

describe("Change: the picker round trip", () => {
  it("keeps tiers, time rules and the words we read; new tags get a tier and no via", () => {
    const value = pickerFromRules(PRIYA, ["vegetarian"])
    expect(value).toEqual({ presets: ["vegetarian"], forbid: PRIYA.forbid, allow: ["dairy"], allergens: [] })
    const next = rulesFromPicker({ ...value, forbid: [...value.forbid, "mushroom"], allergens: ["peanut"] }, PRIYA)
    expect(next.time_rules).toEqual(PRIYA.time_rules)
    expect(next.tiers.mushroom).toBe("hard")
    expect(next.tiers.peanut).toBe("hard")
    expect(next.forbid).toContain("peanut")
    const chips = chipsFor(next, [{ tag: "meat", kind: "forbid", tier: "hard", via: "pure veg → vegetarian", source: "dictionary" }])
    expect(chips.find((c) => c.tag === "meat")?.via).toBe("pure veg → vegetarian")
    expect(chips.find((c) => c.tag === "peanut")).toMatchObject({ kind: "allergen", via: "" })
  })
})
