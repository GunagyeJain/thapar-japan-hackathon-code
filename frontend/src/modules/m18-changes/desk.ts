// Change desk helpers: find the passenger, turn the picker's answer into passport-shaped rules.
// No React here, so it is easy to test.
import { loadRules, paths } from "@/lib/rules"
import type { Passenger } from "@/lib/types"
import { toRequest } from "@/modules/m3-passenger/diet"
import type { DietValue } from "@/modules/m3-passenger/types"

import type { Rules, Tier } from "./types"

// Same split as m17's passport (backend/app/modules/m17_passport/service.py): religious or ethical rules are never
// bent, sugar is medical, everything else is taste. Allergies are always hard.
const HARD_ROOTS = new Set([
  "meat", "seafood", "egg", "gelatin", "alcohol", "allium", "root_veg", "fungi", "honey", "dairy",
  "beef", "pork", "non_halal_meat", "lard", "meat_extract", "grain", "legume",
])
const FIRM_ROOTS = new Set(["sugar"])

export function tierFor(tag: string, allergens: readonly string[] = []): Tier {
  if (allergens.includes(tag)) return "hard"
  if (!loadRules().tags.has(tag)) return "soft"
  const ancestors = [...paths(tag).keys()]
  if (ancestors.some((a) => HARD_ROOTS.has(a))) return "hard"
  if (ancestors.some((a) => FIRM_ROOTS.has(a))) return "firm"
  return "soft"
}

/** What the change desk sends as `rules` from the diet picker. */
export function rulesFromDiet(diet: DietValue): Rules {
  const { forbid, allow, allergens } = toRequest(diet)
  return {
    forbid,
    allow,
    allergens,
    tiers: Object.fromEntries(forbid.map((tag) => [tag, tierFor(tag, allergens)])),
    flex: false,
    time_rules: [],
  }
}

export const MAX_HITS = 6
const SEAT = /^\d{1,2}[A-K]$/
const PNR = /^[A-Z0-9]{6}$/

/**
 * Find passengers by seat ("31K"), PNR + surname ("B82HTY MEHTA") or surname ("MEH").
 * A PNR on its own lists everyone on that booking.
 */
export function findPassengers(list: Passenger[], query: string, max: number = MAX_HITS): Passenger[] {
  const words = query.trim().toUpperCase().split(/\s+/).filter(Boolean)
  if (!words.length) return []
  const seat = words.find((w) => SEAT.test(w))
  if (seat) return list.filter((p) => p.seat === seat).slice(0, max)
  const pnr = words.find((w) => PNR.test(w) && list.some((p) => p.pnr === w))
  const [first, ...more] = words.filter((w) => w !== pnr)
  const named = (p: Passenger) =>
    first === undefined || (p.surname.startsWith(first) && more.every((w) => p.given.startsWith(w) || p.surname.startsWith(w)))
  const hits = pnr ? list.filter((p) => p.pnr === pnr && named(p)) : list.filter(named)
  return hits.slice(0, max)
}
