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
