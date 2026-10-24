// Stand-in for m18's endpoints until they are on main: the seven JL740 Chaos Mode events from docs/plan/v2.md,
// with seats and names from shared/seed/passengers.json. api.ts switches to the server by itself as soon as the
// endpoints answer. The state lives in this module, so Run, Reset and the change desk can be rehearsed.
import flightJson from "@shared/seed/flight.json"
import specsJson from "@shared/seed/meal_specs.json"

import { combinePresets } from "@/lib/rules"
import type { Lang, MealSpec, Text } from "@/lib/types"

import { tierFor } from "./desk"
import { ANSWER, fillMessage, MEAL } from "./i18n"
import { WINDOW_RUNGS } from "./labels"
import { ladderSegments, windowAt } from "./ladder"
import { metricsFromEvents } from "./metrics"
import type { ChangeEvent, ChangeRequest, ChangesResponse, Decision, MetricsResponse, Tier, WindowSpan } from "./types"

export const MOCK_FLIGHT_ID = "JL740-20261025"
const SPECS = specsJson as MealSpec[]
export const SEGMENTS = ladderSegments(flightJson)

/** Diets known before the cutoff: 23 passports from SSRs + 80 chat answers + Priya's own (m17 seed); today only the 24 SSRs. */
export const KNOWN = { ours: 104, today: 24, passengers: 186 }

type FoodRules = { forbid: string[]; allow: string[] }

function request(rules: FoodRules, lang: Lang, note: string | null = null, tiers?: Record<string, Tier>): ChangeRequest {
  return { forbid: rules.forbid, allow: rules.allow, tiers: tiers ?? Object.fromEntries(rules.forbid.map((t) => [t, tierFor(t)])), note, lang }
}

export function specName(specId: string | null): Text | null {
  return SPECS.find((s) => s.id === specId)?.name ?? null
}

type DecisionIn = Omit<Decision, "spec_name"> & { spec_name?: Text }

interface EventIn {
  id: string
  at: string
  channel: ChangeEvent["channel"]
  kind: ChangeEvent["kind"]
  who: [passengerId: string, seat: string, name: string] | null
  request: ChangeRequest
  decision: DecisionIn
  message: Text | null
  today: [ok: boolean, outcome: string]
}

function ev(e: EventIn): ChangeEvent {
  return {
    id: e.id,
    flight_id: MOCK_FLIGHT_ID,
    passenger_id: e.who?.[0] ?? null,
    seat: e.who?.[1] ?? null,
    name: e.who?.[2] ?? null,
    at: e.at,
    channel: e.channel,
    kind: e.kind,
    window: windowAt(e.at, SEGMENTS),
    request: e.request,
    decision: { ...e.decision, spec_name: e.decision.spec_name ?? specName(e.decision.spec_id) },
    message: e.message,
    today: { ok: e.today[0], outcome: { en: e.today[1] } },
    status: "done",
  }
}

const JAIN = combinePresets(["jain"])
const VEG = combinePresets(["vegetarian"])
const VRAT = combinePresets(["vrat"])
const DIABETIC = combinePresets(["diabetic"])
const NONE: FoodRules = { forbid: [], allow: [] }
const reason = (en: string): Text => ({ en })

export const CHAOS_EVENTS: ChangeEvent[] = [
  ev({
    id: "CH-JL740-01",
    at: "2026-10-24T11:30:00+05:30",
    channel: "chat",
    kind: "family_member",
    who: ["PX-0184", "39G", "Rajiv Das"],
    request: request(JAIN, "hi", "Travelling with Shreya Das (36K), who booked AVML"),
    decision: {
      rung: "caterer_add", ok: true, item_id: null, spec_id: "SPEC-VJML", code: "VJML", kitchen_note: null,
      reason: reason("Past the cutoff, before the caterer's final list: VJML added to meal list v3"),
      steps_tried: ["caterer_add"],
    },
    message: fillMessage(ANSWER.caterer_add, MEAL.VJML, "39G"),
    today: [false, "No channel after the cutoff"],
  }),
  ev({
    id: "CH-JL740-02",
    at: "2026-10-24T23:02:00+05:30",
    channel: "feed",
    kind: "lost_request",
    who: ["PX-0057", "23C", "Priya Sharma"],
    request: request(VRAT, "hi", "Rebooking from the IndiGo codeshare dropped her meal"),
    decision: {
      rung: "caterer_add", ok: true, item_id: null, spec_id: "SPEC-AVML-VRAT", code: "AVML", kitchen_note: "VRAT NO ONION NO GARLIC",
      reason: reason("Her passport travelled to the new booking; staff approved “request again” before the 00:40 final list"),
      steps_tried: ["caterer_add"],
    },
    message: fillMessage(ANSWER.caterer_add, MEAL.AVML, "23C"),
    today: [false, "Nobody notices the dropped meal"],
  }),
  ev({
    id: "CH-JL740-03",
    at: "2026-10-25T01:10:00+05:30",
    channel: "checkin",
    kind: "new_need",
    who: ["PX-0109", "30C", "Swati Chauhan"],
    request: request(DIABETIC, "en", null, { sugar: "firm", honey: "firm" }),
    decision: {
      rung: "standby_uplift", ok: true, item_id: "TB-SB4D1K", spec_id: "SPEC-DBML-STANDBY", code: "DBML", kitchen_note: null,
      spec_name: { en: "Diabetic meal: moong dal, mixed vegetables, multigrain roti", ja: "糖尿病対応食：ムングダル、野菜、雑穀ロティ" },
      reason: reason("DBML ×1 in the caterer's standby bank goes out on the 02:05 truck to galley 2"),
      steps_tried: ["standby_uplift"],
    },
    message: fillMessage(ANSWER.standby_uplift, MEAL.DBML, "30C"),
    today: [false, "“Too late for a special meal”"],
  }),
  ev({
    id: "CH-JL740-04",
    at: "2026-10-25T02:50:00+05:30",
    channel: "gate",
    kind: "new_need",
    who: ["PX-0122", "31K", "Ramesh Mehta"],
    request: request(JAIN, "hi"),
    decision: {
      rung: "onboard_spare", ok: true, item_id: "TB-YNFF5J", spec_id: "SPEC-VJML", code: "VJML", kitchen_note: null,
      reason: reason("The spare VJML in galley 2 fits his rules"),
      steps_tried: [
        { rung: "lounge", ok: false, reason: "The lounge serves business class only; 31K is economy" },
        { rung: "airside_partner", ok: false, reason: "The airside partner is closed 00:00–05:00" },
        "onboard_spare",
      ],
    },
    message: fillMessage(ANSWER.onboard_spare, MEAL.VJML, "31K"),
    today: [true, "Crew might find the spare by luck, unchecked"],
  }),
  ev({
    id: "CH-JL740-05",
    at: "2026-10-25T03:50:00+05:30",
    channel: "boarding",
    kind: "no_show",
    who: ["PX-0166", "37E", "Deepak Singh"],
    request: request(NONE, "en", "Did not board"),
    decision: {
      rung: "noshow_release", ok: true, item_id: "TB-VCYX97", spec_id: "SPEC-AVML", code: "AVML", kitchen_note: null,
      reason: reason("37E did not board: his AVML is free for the next request"),
      steps_tried: ["noshow_release"],
    },
    message: null,
    today: [false, "The meal is thrown away"],
  }),
  ev({
    id: "CH-JL740-06",
    at: "2026-10-25T06:10:00+05:30",
    channel: "crew",
    kind: "mind_change",
    who: ["PX-0174", "38E", "Priyanka Kulkarni"],
    request: request(VRAT, "hi", "Realised today is Sharad Purnima"),
    decision: {
      rung: "reserve_pouch", ok: true, item_id: "TB-RP3V8M", spec_id: "SPEC-POUCH-UNIVERSAL", code: null, kitchen_note: "VRAT",
      spec_name: { en: "Universal plate, sealed pouch (heated)", ja: "ユニバーサルプレート（密封パウチ・加温）" },
      reason: reason("The universal plate has no grains, legumes, onion or garlic: fine on a fast day"),
      steps_tried: [
        { rung: "onboard_spare", ok: false, reason: "The spare AVML has onion and garlic" },
        { rung: "noshow_release", ok: false, reason: "37E's AVML has rice and dal: not for a fast day" },
        "reserve_pouch",
      ],
    },
    message: fillMessage(ANSWER.reserve_pouch, MEAL.POUCH, "38E"),
    today: [false, "The veg main has grains"],
  }),
  ev({
    id: "CH-JL740-07",
    at: "2026-10-25T06:30:00+05:30",
    channel: "crew",
    kind: "run_out",
    who: ["PX-0171", "38A", "Rahul Menon"],
    request: request(VEG, "en", "Rows 34–39: more declared vegetarians than paneer left"),
    decision: {
      rung: "flex_swap", ok: true, item_id: "TB-EBLV4B", spec_id: "SPEC-Y-PANEER", code: null, kitchen_note: null,
      reason: reason("36C opted into flex: he takes chicken for miles and his paneer goes to 38A"),
      steps_tried: [
        { rung: "onboard_spare", ok: false, reason: "The spare AVML went to the first vegetarian short" },
        { rung: "noshow_release", ok: false, reason: "37E's AVML went to the second" },
        "flex_swap",
      ],
    },
    message: fillMessage(ANSWER.flex_swap, MEAL.MAIN, "38A"),
    today: [false, "Paneer runs out: the last vegetarians go without"],
  }),
]

/** Items the chaos script uses up, so the change desk doesn't hand them out twice. */
const CHAOS_USED = ["TB-YNFF5J", "TB-PB8Y8J", "TB-VCYX97", "TB-EBLV4B"]

interface MockState {
  events: ChangeEvent[]
  used: string[]
  standbyUsed: string[]
}

// Sample data starts with the script already run, so the screens show the whole story before the server has it.
let state: MockState = { events: CHAOS_EVENTS, used: CHAOS_USED, standbyUsed: ["DBML"] }

export function mockState(): MockState {
  return state
}

export function mockWindows(): WindowSpan[] {
  return SEGMENTS.map((s) => ({
    window: s.window,
    from: new Date(s.from).toISOString(),
    to: new Date(s.to).toISOString(),
    rungs: WINDOW_RUNGS[s.window],
  }))
}

export function mockChanges(now: string): ChangesResponse {
  return { now, window: windowAt(now, SEGMENTS), windows: mockWindows(), events: state.events }
}

export function mockMetrics(): MetricsResponse {
  return metricsFromEvents(state.events, KNOWN)
}

/** Fires the seven events once per reset, like POST /api/chaos/run. */
export function mockRunChaos(): { events: ChangeEvent[]; metrics: MetricsResponse } {
  const fresh = CHAOS_EVENTS.filter((c) => !state.events.some((e) => e.id === c.id))
  state = {
    events: [...state.events, ...fresh],
    used: [...new Set([...state.used, ...CHAOS_USED])],
    standbyUsed: [...new Set([...state.standbyUsed, "DBML"])],
  }
  return { events: fresh, metrics: mockMetrics() }
}

export function mockReset(): { ok: boolean } {
  state = { events: [], used: [], standbyUsed: [] }
  return { ok: true }
}

export function mockAdd(event: ChangeEvent, used: string[], standbyUsed: string[]): ChangeEvent {
  state = {
    events: [...state.events, event],
    used: [...state.used, ...used],
    standbyUsed: [...state.standbyUsed, ...standbyUsed],
  }
  return event
}
