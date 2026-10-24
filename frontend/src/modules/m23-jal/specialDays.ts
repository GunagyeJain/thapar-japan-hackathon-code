// Special days on the meal form: a fast on calendar days, or vegetarian on a weekday. They become time rules; the
// Calendar Radar asks about a fast date before it changes any meal (confirm: true), so a wrong guess costs one tap.
import { calendar } from "@/lib/rules"
import type { Text } from "@/lib/types"
import type { Rules, TimeRule } from "@/modules/m17-passport/types"
import type { DietValue } from "@/modules/m3-passenger/types"

export interface SpecialDay {
  id: string
  label: Text
  rule: () => TimeRule
}

const datesOf = (observance: string): string[] =>
  calendar().observances.find((o) => o.id === observance)?.days.map((d) => d.date) ?? []

const fast = (observance: string, label: Text): SpecialDay => ({
  id: observance,
  label,
  rule: () => ({ id: `TR-${observance}`, kind: "dates", dates: datesOf(observance), preset: "vrat", confirm: true }),
})

const vegOn = (id: string, weekday: number, label: Text): SpecialDay => ({
  id,
  label,
  rule: () => ({ id: `TR-${id}`, kind: "weekday", weekdays: [weekday], preset: "vegetarian" }),
})

export const SPECIAL_DAYS: SpecialDay[] = [
  fast("purnima", { en: "Purnima fast", hi: "पूर्णिमा व्रत", ja: "満月の断食" }),
  fast("ekadashi", { en: "Ekadashi fast", hi: "एकादशी व्रत", ja: "エーカーダシーの断食" }),
  fast("navratri", { en: "Navratri fast", hi: "नवरात्रि व्रत", ja: "ナヴァラートリの断食" }),
  vegOn("veg_tuesday", 1, { en: "Veg on Tuesdays", hi: "मंगलवार शाकाहारी", ja: "火曜はベジ" }),
  vegOn("veg_monday", 0, { en: "Veg on Mondays", hi: "सोमवार शाकाहारी", ja: "月曜はベジ" }),
]

/** Which special days a saved passport already has (so the form opens with them ticked). */
export function specialDaysOf(rules: Pick<Rules, "time_rules"> | null | undefined): string[] {
  const out: string[] = []
  for (const day of SPECIAL_DAYS) {
    const want = day.rule()
    const has = (rules?.time_rules ?? []).some((r) =>
      want.kind === "weekday"
        ? r.kind === "weekday" && r.preset === want.preset && (r.weekdays ?? []).join() === (want.weekdays ?? []).join()
        : r.kind === "dates" && (r.dates ?? []).some((d) => (want.dates ?? []).includes(d)),
    )
    if (has) out.push(day.id)
  }
  return out
}

/** The form's answers as the Rules a passport stores (the server fills in tiers). */
export function formRules(diet: { forbid: string[]; allow: string[]; allergens: string[] }, days: readonly string[]): Omit<Rules, "tiers"> {
  return {
    forbid: diet.forbid,
    allow: diet.allow,
    allergens: diet.allergens,
    flex: false,
    time_rules: SPECIAL_DAYS.filter((d) => days.includes(d.id)).map((d) => d.rule()),
  }
}

/** The picker's value for saved rules: what they can't eat, what they can, allergies apart. */
export function dietOf(rules: Pick<Rules, "forbid" | "allow" | "allergens"> | null | undefined): DietValue {
  const allergens = rules?.allergens ?? []
  return {
    presets: [],
    forbid: (rules?.forbid ?? []).filter((t) => !allergens.includes(t)),
    allow: rules?.allow ?? [],
    allergens,
  }
}
