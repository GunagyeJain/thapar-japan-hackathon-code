// GET /api/load/{flight_id} (shared/api.md, "m19 · smart load").
import type { Fired, Text, Verdict } from "@/lib/types"

export type FamilyId =
  | "non_veg"
  | "no_beef"
  | "halal"
  | "vegetarian"
  | "veg_no_onion_garlic"
  | "jain"
  | "vegan"
  | "eggetarian"
  | "fasting"
  | "diabetic"
  | "allergy"

export interface Family {
  family: FamilyId
  label: Text
  tier: "hard" | "firm" | "soft" | "none"
  known: number
  forecast: number
  p90: number
  loaded: number
  loaded_from: { special: number; main: number; spare: number }
  risk: boolean
  share: number
}

export interface Newsvendor {
  q: number
  cu: number
  co: number
  ratio: number
  covered: number
  expected_unused: number
  expected_waste: number
  expected_short: number
  cost_per_flight: number
}

export interface Reserve {
  lambda: number
  base: number
  factors: { label: Text; factor: number; source: string }[]
  fresh: Newsvendor
  pouch: Newsvendor
  loaded: number
  loaded_covered: number
  formula: Text
  point: Text
}

export interface Candidate {
  id: string
  name: Text
  tags: string[]
  reserve: boolean
  covers: number
  checks: number
  matrix: Verdict[]
  fired: Fired[][]
}

export interface Universal {
  profiles: { id: string; label: Text }[]
  candidates: Candidate[]
  notes: Text[]
}

export type Slot = "base" | "main" | "side" | "curd" | "sweet"

export interface Cup {
  id: string
  slot: Slot
  name: Text
  tags: string[]
  standard: boolean
  safe_for: string[]
}

export interface Spare {
  cup_id: string
  slot: Slot
  name: Text
  covers: string[]
  lambda: number
  count: number
}

export interface Bento {
  slots: { id: Slot; label: Text }[]
  tray: Cup[]
  components: Cup[]
  needs: { id: string; label: Text; lambda: number; fails: Slot[] }[]
  spares: Spare[]
  total_cups: number
  cups_if_stocked_apart: number
  design: Text
}

export interface Assumption {
  id: string
  label: Text
  value: string
  source: Text
}

export interface LoadPlan {
  flight_id: string
  flight_no: string
  date: string
  passengers: number
  known: number
  unknown: number
  families: Family[]
  reserve: Reserve
  universal: Universal
  bento: Bento
  assumptions: Assumption[]
  method: Text
}
