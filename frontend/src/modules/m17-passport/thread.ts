// Passport helpers with no React in them: strictness tiers (a port of service.tier_for) and the Calendar Radar's
// question and answer messages, used by /jal (m23) and the change desk (m18).
import { paths } from "@/lib/rules"
import type { Notification, Text } from "@/lib/types"

import type { RadarOption, Rules, Tier } from "./types"

// Same roots as backend/app/modules/m17_passport/service.py: religion or ethics → hard; sugar → firm (medical).
const HARD_ROOTS = new Set([
  "meat", "seafood", "egg", "gelatin", "alcohol", "allium", "root_veg", "fungi", "honey", "dairy",
  "beef", "pork", "non_halal_meat", "lard", "meat_extract", "grain", "legume",
])
const FIRM_ROOTS = new Set(["sugar"])
const TIER_ORDER: Record<Tier, number> = { hard: 3, firm: 2, soft: 1 }

export function tierFor(tag: string, allergens: readonly string[] = []): Tier {
  if (allergens.includes(tag)) return "hard"
  const ancestors = [...paths(tag).keys()]
  if (ancestors.some((a) => HARD_ROOTS.has(a))) return "hard"
  if (ancestors.some((a) => FIRM_ROOTS.has(a))) return "firm"
  return "soft"
}

/** The strongest tier among the rules, for the summary line. */
export function strictest(rules: Pick<Rules, "tiers">): Tier | null {
  const tiers = Object.values(rules.tiers)
  return tiers.length ? tiers.reduce((a, b) => (TIER_ORDER[b] > TIER_ORDER[a] ? b : a)) : null
}

export interface RadarQuestionRef {
  kind: "radar_question"
  question_id: string
  options: RadarOption[]
  question?: Text
  date?: string
  flight_no?: string
}

export function radarQuestion(note: Notification): RadarQuestionRef | null {
  const ref = note.ref as Partial<RadarQuestionRef>
  if (ref.kind !== "radar_question" || typeof ref.question_id !== "string" || !Array.isArray(ref.options)) return null
  return ref as RadarQuestionRef
}

/** question id → the option the passenger picked, from the Radar's replies. */
export function answeredQuestions(notes: readonly Notification[]): Map<string, string> {
  const out = new Map<string, string>()
  for (const n of notes) {
    const ref = n.ref as { kind?: string; question_id?: string; option_id?: string }
    if (ref.kind === "radar_answer" && ref.question_id && ref.option_id) out.set(ref.question_id, ref.option_id)
  }
  return out
}
