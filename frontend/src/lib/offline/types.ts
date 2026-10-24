import type { Flight, MealItem, MealPromise, MealSpec, Passenger, Verdict } from "@/lib/types"

/** GET /api/flights/{id}/crew-package */
export interface CrewPackage {
  flight: Flight
  passengers: Passenger[]
  promises: MealPromise[]
  items: MealItem[]
  specs: MealSpec[]
  verdicts: Record<string, Record<string, Verdict>>
  forbid: Record<string, { forbid: string[]; source: string }>
  expected_specials: string[]
  rules_version: string
  seed_epoch: number
  generated_at: string
}

export type CrewEventType = "galley_found" | "galley_missing" | "seat_scan" | "swap_backup"

export interface CrewEvent {
  client_id: string
  type: CrewEventType
  item_id: string
  passenger_id?: string
  seat?: string
  verdict?: Verdict
  reason?: string
  at: string
  /** The device's real clock. The server turns it into sim time, since `at` goes stale if the demo moves the clock while offline. */
  wall_at?: string
}

export interface StoredPackage {
  flight_id: string
  pkg: CrewPackage
  downloaded_at: string // sim time
}

export interface QueuedEvent {
  client_id: string
  flight_id: string
  seed_epoch: number
  event: CrewEvent
}
