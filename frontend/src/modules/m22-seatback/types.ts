// m22 shapes, as in shared/api.md (## m22).
import type { Lang, Text } from "@/lib/types"

export type SeatStatus = "asked" | "confirmed" | "skipped" | "changed" | "no_answer"
export type Held = "special" | "main"
export type Answer = "yes" | "no" | "change"

export interface SeatMeal {
  item_id: string | null
  spec_id: string | null
  name: Text | null
  code: string | null
  galley: string | null
  /** The tray's label mark: food rules, never a diet's name. */
  mark?: Text | null
}

export interface SeatQuestion {
  id: string
  status: SeatStatus
  held: Held
  asked_at: string
  answered_at: string | null
  meal: SeatMeal
  choice: SeatMeal | null
}

export interface SeatView {
  flight: { id: string; flight_no: string; origin: string; dest: string; std: string; sta: string }
  seat: string
  now: string
  occupied: boolean
  initials: string | null
  lang: Lang
  ask: SeatQuestion | null
}

export interface SeatOption {
  spec_id: string
  name: Text
  code: string | null
  /** freed: given up on board by a no-show or another seat · spare: a spare special meal · main: from the trolley */
  source: "freed" | "spare" | "main"
  count: number
  item_id: string
  galley: string
}

export interface SeatOptions {
  seat: string
  rules_known: boolean
  options: SeatOption[]
}

export interface SeatbackRow {
  seat: string
  passenger_id: string
  status: SeatStatus
  held: Held
  asked_at: string
  answered_at: string | null
  item_id: string | null
  spec_id: string | null
  new_item_id: string | null
  released_item_id: string | null
}

export interface SeatbackStatus {
  flight_id: string
  now: string
  round: number
  asked_at: string | null
  no_answer_after_min: number
  counts: Record<SeatStatus, number>
  seats: SeatbackRow[]
}
