// Core entity types. Field names match shared/README.md (shared zone: add optional fields only).

export type Lang = "en" | "hi" | "ja"
export interface Text {
  en: string
  hi?: string
  ja?: string
}
export type Iso = string

export type CheckpointId = "C1" | "C2" | "C3" | "C4" | "C5"
export type CheckpointState = "ok" | "fail" | "fixed" | "pending"
export type Verdict = "SAFE" | "UNSAFE" | "NEEDS_HUMAN"

export interface CabinLayout {
  rows: [number, number]
  letters: string
  seats: number
}

export interface Flight {
  id: string
  flight_no: string
  date: string
  origin: string
  dest: string
  std: Iso
  sta: Iso
  aircraft: string
  cabins: { C: CabinLayout; Y: CabinLayout }
  special_meal_cutoff: Iso
  caterer_final_list_at: Iso
  dispatch_at: Iso
  boarding_at: Iso
  status: "scheduled" | "delayed" | "departed"
  delay_min: number
  caterer: string
  backup_count: number
}

export interface FlightDetail extends Flight {
  counts: { passengers: number; special_meals: number; open_alerts: number }
}

export interface Passenger {
  id: string
  flight_id: string
  seat: string
  cabin: "C" | "Y"
  surname: string
  given: string
  title: string
  pnr: string
  ssr_meal: string | null
  ssr_note: string | null
  inbound: { flight: string; from: string; date: string } | null
  group: string | null
  is_judge: boolean
  display_name: string | null
  profile_id: string | null
}

export interface Consent {
  this_trip: boolean
  save_profile: boolean
  share_with_caterer: boolean
  cross_border_ack: boolean
  at: Iso
}

export interface Profile {
  id: string
  passenger_id: string
  lang: Lang
  presets: string[]
  forbid: string[]
  allow: string[]
  fasting_dates: string[]
  allergens: string[]
  consent: Consent
  created_at: Iso
  expires_at: Iso | null
}

export interface MealPromise {
  id: string
  profile_id: string
  passenger_id: string
  flight_id: string
  code: string
  kitchen_note: string | null
  label_mark: Text
  status: "ok" | "at_risk" | "broken" | "fixed"
  checkpoints: Record<CheckpointId, CheckpointState>
}

export type PassengerWithPromise = Passenger & { promise?: MealPromise }

export interface CheckpointEvent {
  id: string
  promise_id: string | null
  passenger_id: string
  flight_id: string
  checkpoint: CheckpointId | "LATE"
  result: "ok" | "fail" | "fixed" | "info"
  at: Iso
  source: string
  detail: string
  data: Record<string, unknown>
  key: string | null
}

export interface MealSpec {
  id: string
  name: Text
  code: string | null
  kind: "special" | "main" | "backup"
  tags: string[]
  certified: boolean
  source: "caterer" | "recipe_check"
}

export interface MealItem {
  id: string
  flight_id: string
  spec_id: string
  kind: "special" | "spare" | "main" | "backup"
  galley: "G1" | "G2"
  position: string
  assigned_passenger_id: string | null
  status: "planned" | "loaded" | "missing" | "served"
}

export interface AlertAction {
  action: string
  actor: string
  at: Iso
  note?: string
}

export interface Alert {
  id: string
  flight_id: string
  type: string
  severity: "critical" | "warning" | "info"
  passenger_id: string | null
  promise_id: string | null
  title: string
  body: string
  evidence: Record<string, unknown>
  deadline_at: Iso | null
  status: "open" | "acknowledged" | "resolved"
  created_at: Iso
  actions: AlertAction[]
}

export interface RawMessage {
  id: string
  flight_id: string
  kind: "PNL" | "ADL"
  seq: number
  received_at: Iso
  text: string
}

export interface Notification {
  id: string
  channel: "sms" | "whatsapp" | "email" | "crew" | "caterer"
  to: string
  lang: Lang
  title: string
  body: string
  at: Iso
  ref: Record<string, unknown>
}

/** A rule that fired in a verdict (m1). `via` is the chain, e.g. "出汁 → bonito → fish". */
export interface Fired {
  rule_id: string
  tag: string
  via: string
  diet?: string
  message: Text
}
