// Replays shared/rules/vectors.json; backend/tests/test_m1_vectors.py replays the same file.
import vectors from "@shared/rules/vectors.json"
import { describe, expect, it } from "vitest"
import { combinePresets, evaluate, evaluateDiet } from "./index"

type Case = { id: string; forbid: string[]; tags: string[]; expect: unknown }

const cases = vectors.evaluate as Case[]

describe("shared rule vectors", () => {
  it(`${cases.length} rule vectors: server and offline tablet agree`, () => {
    const failed = cases.filter((c) => JSON.stringify(sortKeys(evaluate(c.forbid, c.tags))) !== JSON.stringify(sortKeys(c.expect)))
    expect(cases.length).toBe(vectors.count)
    expect(cases.length).toBeGreaterThanOrEqual(150)
    expect(failed.map((c) => c.id)).toEqual([])
  })

  it("Jain vs paneer butter masala fires onion and garlic", () => {
    const { verdict, fired } = evaluateDiet("jain", ["paneer", "butter", "tomato", "onion", "garlic"])
    expect(verdict).toBe("UNSAFE")
    expect(fired.map((f) => f.via)).toEqual(["onion → allium", "garlic → allium"])
  })

  it("combines presets like the server", () => {
    expect(combinePresets(["vegetarian", "no_onion_garlic"])).toEqual({
      forbid: ["meat", "seafood", "egg", "gelatin", "onion", "garlic"],
      allow: ["dairy"],
    })
  })
})

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys)
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, sortKeys(v)]))
  }
  return value
}
