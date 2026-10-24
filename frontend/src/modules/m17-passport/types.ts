// m17 shapes from shared/api.md (## m17) and docs/plan/v2.md ("Shared shapes"). Field names match the API exactly.
import type { MealPromise, Text } from "@/lib/types"

export type Tier = "hard" | "firm" | "soft"

export interface TimeRule {
  id: string
  kind: "dates" | "weekday" | "daylight" | "dawn_to_sunset"
  dates?: string[]
  weekdays?: number[]
  preset?: "vrat" | "vegetarian"
  add_forbid?: string[]
  after_sunrise_min?: number
  confirm?: boolean
  confirmed?: string[]
  declined?: string[]
}

/** What the phone shows for a time rule; `label` and `via` never reach the database. */
export type LabelledTimeRule = TimeRule & { label: Text; via?: string }

export interface Rules {
  forbid: string[]
  allow: string[]
  allergens: string[]
  tiers: Record<string, Tier>
  flex: boolean
  time_rules: TimeRule[]
}

export interface Chip {
  tag: string
  kind: "forbid" | "allow" | "allergen"
  tier: Tier | null
  via: string
  source: "dictionary" | "model"
}

export interface Understood {
  rules: Rules
  chips: Chip[]
  time_rules: LabelledTimeRule[]
  unclear: string[]
  source: "dictionary" | "model" | "both"
  /** Diet words recognised (m1 preset ids), so Change can open the picker with them ticked. Phone only. */
  presets: string[]
}

export interface Plan {
  main_pick: string | null
  main_pick_name: Text | null
  code: string | null
  kitchen_note: string | null
  forbid: string[]
  allow: string[]
  time_rules_active: string[]
}

export interface Passport {
  id: string
  passenger_id: string
  lang: string
  rules: Rules
  code: string | null
  kitchen_note: string | null
  label_mark: Text
  source: string
  confirmed: boolean
  updated_at: string
}

export interface SaveOut {
  passport: Passport
  plan: Plan
  promise: MealPromise | null
}

export interface BookingPerson {
  passenger_id: string
  name: string
  surname: string
  seat: string
  has_passport: boolean
}

export interface BookingOut {
  pnr: string
  flight_no: string | null
  passenger: BookingPerson
  passengers: BookingPerson[]
}

export interface RadarOption {
  id: "yes" | "no"
  label: Text
}

export interface AnswerOut {
  question_id: string
  applied: boolean
  plan: Plan
  change: Record<string, unknown> | null
}
