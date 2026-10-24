// How a change event reads on screen: the need as short food rules, the decision in plain words,
// every rung tried and the two outcome chips. No React here, so it is easy to test.
import { t } from "@/lib/i18n"
import type { Lang } from "@/lib/types"
import type { Status } from "@/ui"
import { summaryChips } from "@/modules/m3-passenger/diet"

import { CODE_NOUN, GALLEY_WORDS, SKIP_REASON } from "./labels"
import type { ChangeEvent, ChangeRequest, Decision, Rung } from "./types"

/** "No meat, fish, egg · No onion or garlic · Dairy OK", or "No food rules". */
export function needSummary(request: Pick<ChangeRequest, "forbid" | "allow">, lang: Lang = "en"): string {
  if (!request.forbid.length) return "No food rules"
  const chips = summaryChips({ presets: [], forbid: request.forbid, allow: request.allow, allergens: [] })
  return chips.map((c) => t(c.text, lang)).join(" · ")
}

export interface ItemPlace {
  galley: string
  position: string
}

const capitalise = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1)

function mealNoun(d: Pick<Decision, "code" | "spec_name">): string {
  if (d.code) return CODE_NOUN[d.code] ?? `${d.code} meal`
  return d.spec_name ? t(d.spec_name, "en") : "meal"
}

/** The decision in plain words: "Spare Jain meal · galley 2 · G2-X01". */
export function decisionHeadline(d: Pick<Decision, "rung" | "code" | "spec_name">, place?: ItemPlace | null): string {
  const noun = mealNoun(d)
  const titles: Record<Rung, string> = {
    ssr_change: `${capitalise(noun)} booked as a special meal`,
    caterer_add: `${capitalise(noun)} on the caterer's next list`,
    standby_uplift: `Standby ${noun} from the caterer`,
    lounge: "Lounge meal before boarding",
    airside_partner: "Airside partner meal",
    onboard_spare: `Spare ${noun}`,
    noshow_release: `Released ${noun} from a no-show`,
    reserve_pouch: "Reserve pouch, heated",
    flex_swap: `Flex swap: ${noun}`,
    sunrise_box: "Sunrise box",
    unmet: "Nothing safe left on board",
  }
  const where = place ? [GALLEY_WORDS[place.galley] ?? place.galley, place.position] : []
  return [titles[d.rung], ...where].join(" · ")
}

export interface StepView {
  rung: Rung
  chosen: boolean
  reason: string
}

/** Every rung the router tried, in order: the chosen one with the decision's reason, the others with why they were passed. */
export function stepsOf(d: Pick<Decision, "rung" | "reason" | "steps_tried">): StepView[] {
  const steps = d.steps_tried.map((s) => (typeof s === "string" ? { rung: s } : s))
  const all = steps.some((s) => s.rung === d.rung) ? steps : [...steps, { rung: d.rung }]
  return all.map((s) => {
    const chosen = s.rung === d.rung
    const own = "reason" in s && s.reason ? t(s.reason, "en") : ""
    return { rung: s.rung, chosen, reason: chosen ? t(d.reason, "en") || own : own || SKIP_REASON[s.rung] }
  })
}

export interface OutcomeView {
  status: Status
  label: string
}

/** Result chip for ThaliBento (`ours`) or today's process (`today`). A no-show is about the meal, not a need. */
export function outcomeOf(e: Pick<ChangeEvent, "kind" | "decision" | "today">, side: "ours" | "today"): OutcomeView {
  const ok = side === "ours" ? e.decision.ok : e.today.ok
  if (e.kind === "no_show") {
    if (ok) return { status: "info", label: "Meal kept" }
    return { status: side === "ours" ? "warn" : "unsafe", label: "Thrown away" }
  }
  return ok ? { status: "safe", label: "Met" } : { status: "unsafe", label: "Not met" }
}

/** Events in time order, numbered from 1 (the order the ladder and the log show them). */
export function numbered(events: ChangeEvent[]): (ChangeEvent & { n: number })[] {
  return [...events]
    .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime() || a.id.localeCompare(b.id))
    .map((e, i) => ({ ...e, n: i + 1 }))
}
