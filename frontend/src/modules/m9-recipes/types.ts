// RecipeSheet from shared/api.md (plus its optional extras). Field names match the API exactly.
import type { Fired } from "@/lib/rules"
import type { MealSpec, Text, Verdict } from "@/lib/types"

export type Ingredient = {
  name_ja: string
  name_en: string
  tags: string[]
  confidence: number
  evidence: string
}

export type DietVerdict = { diet: string; verdict: Verdict; fired: Fired[] }

export type RecipeSheet = {
  id: string
  name: Text & { ja?: string }
  source_hash: string
  cached: boolean
  engine: "dictionary" | "gemini" | "dictionary+gemini"
  ingredients: Ingredient[]
  verdicts: DietVerdict[]
  status: "needs_review" | "approved"
  created_at: string
  text?: string | null
  model_note?: string | null
  spec_id?: string | null
  approved_by?: string | null
}

export type ApproveOut = { sheet: RecipeSheet; spec: MealSpec }

// GET /recipes/eval. A family list is what the rules call UNSAFE for a vegetarian; null means
// the model has no cached answer for that sheet yet.
export type EvalRow = {
  id: string
  dish: Text & { ja?: string }
  truth: string[]
  dictionary: string[]
  model: string[] | null
  combined: string[] | null
}

export type EvalMetrics = {
  dishes: number
  hits: number
  misses: number
  false_alarms: number
  recall: number | null
  precision: number | null
  unsafe_dishes: number
  unsafe_dishes_caught: number
  safe_dishes: number
  safe_dishes_flagged: number
}

export type EvalReader = "dictionary" | "model" | "combined"

export type EvalTable = { diet: string; rows: EvalRow[]; compared: number; metrics: Record<EvalReader, EvalMetrics | null> }
