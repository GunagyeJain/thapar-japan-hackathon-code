// m18 shapes from docs/plan/v2.md ("Shared shapes") and shared/api.md (## m17, ## m18). Field names match the API.
import type { Lang, Text } from "@/lib/types"

export type Tier = "hard" | "firm" | "soft"

export interface TimeRule {
  id: string
  kind: "dates" | "weekday" | "daylight" | "dawn_to_sunset"
  dates?: string[]
  weekdays?: number[]
  preset?: "vrat" | "vegetarian"
  add_forbid?: string[]
  after_sunrise_min?: number
}

export interface Rules {
  forbid: string[]
  allow: string[]
  allergens: string[]
  tiers: Record<string, Tier>
  flex: boolean
  time_rules: TimeRule[]
}

export type Window = "ssr" | "caterer_list" | "standby_uplift" | "airport" | "onboard" | "inflight"

export type Rung =
  | "ssr_change"
  | "caterer_add"
  | "standby_uplift"
  | "lounge"
  | "airside_partner"
  | "onboard_spare"
  | "noshow_release"
  | "reserve_pouch"
  | "flex_swap"
  | "sunrise_box"
  | "unmet"

export type Channel = "chat" | "radar" | "checkin" | "lounge" | "gate" | "crew" | "feed" | "boarding"

export type ChangeKind = "new_need" | "mind_change" | "lost_request" | "family_member" | "no_show" | "calendar" | "run_out"

export interface ChangeRequest {
  forbid: string[]
  allow: string[]
  tiers: Record<string, Tier>
  note: string | null
  lang: Lang
}

/** A rung the router tried. The contract sends the rung id; a richer `{rung, ok, reason}` is read too. */
export type StepTried = Rung | { rung: Rung; ok?: boolean; reason?: Text | string }

export interface Decision {
  rung: Rung
  ok: boolean
  item_id: string | null
  spec_id: string | null
  spec_name: Text | null
  code: string | null
  kitchen_note: string | null
  reason: Text
  steps_tried: StepTried[]
}

export interface ChangeEvent {
  id: string
  flight_id: string
  passenger_id: string | null
  seat: string | null
  name: string | null
  at: string
  channel: Channel
  kind: ChangeKind
  window: Window
  request: ChangeRequest
  decision: Decision
  /** What the passenger is told, in their language first. */
  message: Text | null
  /** What today's process would do with the same event. */
  today: { ok: boolean; outcome: Text }
  status: "done" | "waiting"
}

export interface WindowSpan {
  window: Window
  from: string
  to: string
  rungs: Rung[]
}

export interface ChangesResponse {
  now: string
  window: Window
  windows: WindowSpan[]
  events: ChangeEvent[]
}

export interface Metrics {
  events: number
  hard_total: number
  hard_met: number
  firm_total: number
  firm_met: number
  meals_wasted: number
  known_before_cutoff: number
  passengers: number
}

export interface MetricsResponse {
  ours: Metrics
  today: Metrics
}

export interface ChaosRunResponse {
  events: ChangeEvent[]
  metrics?: MetricsResponse
}

export interface SubmitChange {
  flight_id: string
  passenger_id?: string
  channel: Channel
  kind: ChangeKind
  rules?: Rules
  note?: string
  lang?: Lang
}

export interface CabinPassenger {
  passenger_id: string
  seat: string
  cabin: "C" | "Y"
  name: string
  known: boolean
  source: string | null
  tier: Tier | "none"
  flex: boolean
  rules: Rules | null
  card: { ja: string; en: string; hi: string }
}

export interface CabinResponse {
  flight_id: string
  known: number
  total: number
  passengers: CabinPassenger[]
}

export interface UnderstandChip {
  tag: string
  kind: "forbid" | "allow" | "allergen"
  tier: Tier
  via: string
  source: "dictionary" | "model"
}

export interface UnderstandResponse {
  rules: Rules
  chips: UnderstandChip[]
  time_rules: (TimeRule & { label: Text })[]
  unclear: string[]
  source: "dictionary" | "model" | "both"
}

/** A response plus whether it came from the server (`live`) or the stand-in data in mock.ts. */
export interface Feed<T> {
  data: T
  live: boolean
}
