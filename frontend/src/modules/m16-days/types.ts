import type { Text } from "@/lib/types"

export interface Leg {
  flight_no: string
  date: string
  from: string
  to: string
  catered_in: string
  fast_day: boolean
  code: string | null
  kitchen_note: string | null
  kitchen_note_ja: string | null
  label_mark: Text | null
  usual: { code: string; kitchen_note: string | null } | null
}

export interface TripsOut {
  passenger_id: string
  has_profile: boolean
  legs: Leg[]
}

export interface AheadLeg extends Leg {
  passenger_id: string
  seat: string
  name: string
  days_to_go: number
}

export interface AheadOut {
  today: string
  legs: AheadLeg[]
}
