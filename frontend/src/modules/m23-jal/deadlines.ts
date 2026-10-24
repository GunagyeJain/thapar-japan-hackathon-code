// JAL's special-meal deadlines (JAL's special-meal page, jal.co.jp/jp/en/inter/service/meal/special/menu/):
// online until 25 h before departure (24 h by phone); kosher and minimal-allergen meals until 49 h (48 h by phone).
// The 25 h line is the flight's own `special_meal_cutoff`; the 49 h line counts back from the scheduled departure.
import { loadRules } from "@/lib/rules"
import type { Flight, Text } from "@/lib/types"

const HOUR_MS = 3_600_000
export const LONG_LEAD_HOURS = 49

export type DeadlineId = "standard" | "long_lead"

export interface MealDeadline {
  id: DeadlineId
  at: string
  hours: number
  phoneHours: number
}

export function mealDeadlines(flight: Pick<Flight, "std" | "special_meal_cutoff">): MealDeadline[] {
  const longLead = new Date(new Date(flight.std).getTime() - LONG_LEAD_HOURS * HOUR_MS).toISOString()
  return [
    { id: "standard", at: flight.special_meal_cutoff, hours: 25, phoneHours: 24 },
    { id: "long_lead", at: longLead, hours: LONG_LEAD_HOURS, phoneHours: 48 },
  ]
}

/** Still taking requests at sim time `now` (closed while the clock is unknown). */
export function isOpen(at: string, now: Date | null): boolean {
  return now !== null && new Date(at).getTime() > now.getTime()
}

export interface MealChoice {
  id: string
  code: string | null
  name: Text
  deadline: DeadlineId
}

// JAL lists these two as well; the rules engine has no food rules for them, so the form only shows them.
const LONG_LEAD_MEALS: MealChoice[] = [
  { id: "KSML", code: "KSML", name: { en: "Kosher meal", ja: "コーシャミール" }, deadline: "long_lead" },
  { id: "minimal-allergen", code: null, name: { en: "Minimal-allergen meal", ja: "アレルギー対応食" }, deadline: "long_lead" },
]

/** Today's form: every JAL special-meal code, one per passenger. */
export function mealChoices(): MealChoice[] {
  const codes = loadRules().codes.map((c): MealChoice => ({ id: c.code, code: c.code, name: c.name, deadline: "standard" }))
  return [...codes, ...LONG_LEAD_MEALS]
}
