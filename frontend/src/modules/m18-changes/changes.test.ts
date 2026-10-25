// Metrics, decision wording and the change desk's helpers, on the seven JL740 Chaos Mode events.
import passengers from "@shared/seed/passengers.json"
import { describe, expect, it } from "vitest"

import { ApiError } from "@/lib/api"
import { combinePresets } from "@/lib/rules"
import type { Passenger } from "@/lib/types"

import { missingEndpoint, normalizeEvent } from "./api"
import { findPassengers, rulesFromDiet, tierFor } from "./desk"
import { CHAOS_EVENTS, KNOWN, mockMetrics, mockReset } from "./mock"
import { mockSubmit } from "./mockDesk"
import { kpiViews, metricsFromEvents, ratio, strictestTier } from "./metrics"
import type { ChangeEvent } from "./types"
import { decisionHeadline, needSummary, numbered, outcomeOf, stepsOf } from "./words"

const PAX = passengers as Passenger[]

describe("metrics", () => {
  const m = metricsFromEvents(CHAOS_EVENTS, KNOWN)

  it("counts the chaos script like the v2 table: ThaliBento meets every need, today only the lucky spare", () => {
    expect(m.ours).toMatchObject({ events: 7, hard_total: 5, hard_met: 5, firm_total: 1, firm_met: 1, meals_wasted: 0 })
    expect(m.today).toMatchObject({ hard_total: 5, hard_met: 1, firm_total: 1, firm_met: 0, meals_wasted: 1 })
    expect(m.ours.known_before_cutoff).toBe(104)
    expect(m.today.known_before_cutoff).toBe(24)
  })

  it("is all zero before anything happens", () => {
    const empty = metricsFromEvents([], KNOWN)
    expect(empty.ours.hard_total).toBe(0)
    expect(kpiViews(empty)[0]).toMatchObject({ value: "—", delta: "today —", status: undefined })
  })

  it("formats the tiles as ThaliBento vs today", () => {
    const [hard, firm, wasted, known] = kpiViews(m)
    expect(hard).toMatchObject({ value: "5/5", delta: "today 1/5", status: { status: "safe", label: "All met" } })
    expect(firm).toMatchObject({ value: "1/1", delta: "today 0/1" })
    expect(wasted).toMatchObject({ value: "0", delta: "today 1", status: { status: "safe", label: "1 saved" } })
    expect(known).toMatchObject({ value: "104", delta: "of 186 · today 24", status: { status: "info", label: "+80 vs today" } })
  })

  it("flags needs that were not met", () => {
    const missed = metricsFromEvents([{ ...CHAOS_EVENTS[0], decision: { ...CHAOS_EVENTS[0].decision, ok: false } }], KNOWN)
    expect(kpiViews(missed)[0]).toMatchObject({ value: "0/1", status: { status: "unsafe", label: "1 not met" } })
  })

  it("reads ratios and the strictest tier", () => {
    expect(ratio(3, 4)).toBe("3/4")
    expect(ratio(0, 0)).toBe("—")
    expect(strictestTier({ sugar: "firm", mushroom: "soft" })).toBe("firm")
    expect(strictestTier({ sugar: "firm", meat: "hard" })).toBe("hard")
    expect(strictestTier({})).toBe("none")
  })
})

describe("decision wording", () => {
  const mehta = CHAOS_EVENTS[3]

  it("says the rung and the place in plain words", () => {
    expect(decisionHeadline(mehta.decision, { galley: "G2", position: "G2-X01" })).toBe("Spare Jain meal · galley 2 · G2-X01")
    expect(decisionHeadline(CHAOS_EVENTS[2].decision)).toBe("Standby diabetic meal from the caterer")
    expect(decisionHeadline({ rung: "unmet", code: null, spec_name: null })).toBe("Nothing safe left on board")
  })

  it("lists every rung tried, the chosen one last with its reason", () => {
    const steps = stepsOf(mehta.decision)
    expect(steps.map((s) => [s.rung, s.chosen])).toEqual([["lounge", false], ["airside_partner", false], ["onboard_spare", true]])
    expect(steps[2].reason).toBe("The spare VJML in galley 2 fits his rules")
    expect(stepsOf({ rung: "caterer_add", reason: { en: "Added" }, steps_tried: ["standby_uplift"] }).map((s) => s.reason)).toEqual([
      "Nothing in the standby bank fits, or the trucks have left",
      "Added",
    ])
  })

  it("words the outcome for a need and for a no-show", () => {
    expect(outcomeOf(mehta, "ours")).toEqual({ status: "safe", label: "Met" })
    expect(outcomeOf(CHAOS_EVENTS[0], "today")).toEqual({ status: "unsafe", label: "Not met" })
    expect(outcomeOf(CHAOS_EVENTS[4], "ours")).toEqual({ status: "info", label: "Meal kept" })
    expect(outcomeOf(CHAOS_EVENTS[4], "today")).toEqual({ status: "unsafe", label: "Thrown away" })
  })

  it("writes the need as short food rules", () => {
    expect(needSummary({ forbid: ["meat", "seafood", "egg", "gelatin"], allow: ["dairy"] })).toBe("No meat, fish, egg · Also no gelatin · Dairy OK")
    expect(needSummary({ forbid: [], allow: [] })).toBe("No food rules")
  })

  it("numbers events in time order", () => {
    const shuffled = [CHAOS_EVENTS[6], CHAOS_EVENTS[0], CHAOS_EVENTS[3]]
    expect(numbered(shuffled).map((e) => [e.n, e.seat])).toEqual([[1, "39G"], [2, "31K"], [3, "38A"]])
  })
})

describe("change desk", () => {
  it("finds a passenger by seat, PNR + surname or surname", () => {
    expect(findPassengers(PAX, "31k").map((p) => p.surname)).toEqual(["MEHTA"])
    expect(findPassengers(PAX, "6XK2QP sharma").map((p) => p.seat)).toEqual(["23C"])
    expect(findPassengers(PAX, "B82HTY").map((p) => p.seat)).toEqual(["31K"])
    expect(findPassengers(PAX, "6XK2QP mehta")).toEqual([])
    // two SWATI CHAUHANs on board: the name alone finds both, the PNR picks one
    expect(findPassengers(PAX, "chauhan swati").map((p) => p.seat)).toEqual(["30C", "31A"])
    expect(findPassengers(PAX, "UJS7EE chauhan").map((p) => p.seat)).toEqual(["30C"])
    expect(findPassengers(PAX, "  ")).toEqual([])
  })

  it("tiers rules like the passport: religion and allergies hard, sugar firm, taste soft", () => {
    expect(tierFor("onion")).toBe("hard")
    expect(tierFor("sugar")).toBe("firm")
    expect(tierFor("mushroom")).toBe("hard")
    expect(tierFor("tomato")).toBe("soft")
    expect(tierFor("peanut", ["peanut"])).toBe("hard")
  })

  it("turns the picker's answer into passport-shaped rules", () => {
    const rules = rulesFromDiet({ presets: ["diabetic"], forbid: ["sugar", "honey"], allow: [], allergens: ["peanut"] })
    expect(rules.forbid).toEqual(["sugar", "honey", "peanut"])
    expect(rules.tiers).toEqual({ sugar: "firm", honey: "hard", peanut: "hard" })
    expect(rules.allergens).toEqual(["peanut"])
  })
})

describe("stand-in router and reader", () => {
  it("gives 31K the spare VJML at the gate, and the next Jain request the pouch", () => {
    mockReset()
    const body = { flight_id: "JL740-20261025", passenger_id: "PX-0122", channel: "gate" as const, kind: "new_need" as const, rules: rulesFromDiet({ presets: ["jain"], forbid: combinePresets(["jain"]).forbid, allow: ["dairy"] }) }
    const first = mockSubmit(body, "2026-10-25T02:50:00+05:30")
    expect(first.window).toBe("airport")
    expect(first.decision).toMatchObject({ rung: "onboard_spare", ok: true, item_id: "TB-YNFF5J", code: "VJML" })
    expect(first.today.ok).toBe(true)
    const second = mockSubmit(body, "2026-10-25T02:55:00+05:30")
    expect(second.decision.rung).toBe("reserve_pouch")
    expect(mockMetrics().ours.hard_total).toBe(2)
  })
})

describe("fallback to sample data", () => {
  it("only for routes the server doesn't have yet", () => {
    expect(missingEndpoint(new ApiError(404, "Not Found"))).toBe(true)
    expect(missingEndpoint(new ApiError(404, "Not found"))).toBe(true)
    expect(missingEndpoint(new ApiError(405, "Method Not Allowed"))).toBe(true)
    expect(missingEndpoint(new ApiError(404, "No passenger PX-9999"))).toBe(false)
    expect(missingEndpoint(new ApiError(500, "Internal Server Error"))).toBe(false)
    expect(missingEndpoint(new Error("Not Found"))).toBe(false)
  })

  it("fills the parts of an event a screen reads if the server leaves them out", () => {
    const bare = { ...CHAOS_EVENTS[3], request: { forbid: ["meat"] }, decision: { ...CHAOS_EVENTS[3].decision, steps_tried: undefined } }
    const e = normalizeEvent(bare as unknown as ChangeEvent)
    expect(e.request).toMatchObject({ forbid: ["meat"], allow: [], tiers: {}, lang: "en" })
    expect(e.decision.steps_tried).toEqual([])
    expect(stepsOf(e.decision).map((s) => s.rung)).toEqual(["onboard_spare"])
  })
})
