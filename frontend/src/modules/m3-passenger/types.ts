// m3 shapes from shared/api.md that @/lib/types doesn't already have. Field names match the API exactly.
import type { MealPromise, Passenger, Profile, Text } from "@/lib/types"

/** What DietPicker edits. `allergens` is optional so callers can pass just {presets, forbid, allow}. */
export type DietValue = { presets: string[]; forbid: string[]; allow: string[]; allergens?: string[] }

export type CodeOption = {
  code: string
  recommended: boolean
  safety_gaps: string[]
  preference_losses: string[]
  kitchen_note: string | null
  label_mark: Text
  why: Text
}

export type BookingCheck = {
  ok: boolean
  problem?: { contains: string[]; message: Text }
  suggested_code?: string
  kitchen_note?: string | null
}

export type ConsentIn = { this_trip: boolean; save_profile: boolean; share_with_caterer: boolean; cross_border_ack: boolean }

export type ProfileOut = { profile: Profile; promise: MealPromise; booking_check: BookingCheck }
export type JoinOut = { passenger: Passenger; profile: Profile; promise: MealPromise }
