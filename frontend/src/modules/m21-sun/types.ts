// Shapes of /api/sun/* (shared/api.md, "m21 · sun at the aircraft"). Times are ISO strings with an offset.
import type { Text } from "@/lib/types"

export type SunRuleKind = "daylight" | "fast_dawn_to_sunset"

export interface SunRule {
  kind: SunRuleKind
  after_sunrise_min?: number
}

export interface EatWindow {
  may_eat_from: string | null
  may_eat_until: string | null
  sunrise_box: boolean
  note: Text
}

export interface SunEvent {
  at_aircraft: string
  at_origin: string | null
  minutes_earlier: number | null
  lat: number
  lon: number
  alt_m: number
}

export interface TrackPoint {
  at: string
  lat: number
  lon: number
  alt_m: number
  elev: number
  elev_origin: number
}

export interface SunSummary {
  flight_id: string | null
  flight_no: string | null
  origin: string
  dest: string
  dep: string
  arr: string
  threshold_cruise: number
  sunrise: SunEvent | null
  sunset: SunEvent | null
  fajr: SunEvent | null
  chauvihar: EatWindow & { rule: SunRule }
}

export interface SunFlight extends SunSummary {
  track: TrackPoint[]
  delay_min?: number
}

export interface SunPresets {
  date: string
  rule: SunRule
  flights: SunSummary[]
}

export interface SunSeat extends EatWindow {
  seat: string
  passenger_id: string
  rule: SunRule
}

export interface SunSeats {
  flight_id: string
  seats: SunSeat[]
}
