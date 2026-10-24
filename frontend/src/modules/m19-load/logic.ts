// Pure helpers for /ops/load: scales, verdict cells, money and percentages. Tested in logic.test.ts.
import type { Verdict } from "@/lib/types"
import type { Status } from "@/ui"

import type { Family } from "./types"

export interface Cell {
  status: Status
  word: string
  mark: string
}

const CELLS: Record<Verdict, Cell> = {
  SAFE: { status: "safe", word: "Safe", mark: "✓" },
  UNSAFE: { status: "unsafe", word: "No", mark: "✗" },
  NEEDS_HUMAN: { status: "warn", word: "Check", mark: "?" },
}

export function cellFor(verdict: Verdict): Cell {
  return CELLS[verdict]
}

/** "13 of 13", with the needs-a-check count when there is one. */
export function coverLabel(covers: number, total: number, checks = 0): string {
  return checks > 0 ? `${covers} of ${total} (+${checks} to check)` : `${covers} of ${total}`
}

/** The axis end for the family chart: the biggest demand, so small families stay readable; on-board bars may run past it. */
export function axisMax(families: Pick<Family, "p90" | "forecast">[]): number {
  const top = Math.max(1, ...families.map((f) => Math.max(f.p90, f.forecast)))
  return Math.ceil((top * 1.15) / 10) * 10
}

/** Bar width in percent of the axis, clipped to 100. */
export function barPct(value: number, max: number): number {
  if (max <= 0 || value <= 0) return 0
  return Math.min(100, (value / max) * 100)
}

export function fmtInr(value: number): string {
  return `₹${Math.round(value).toLocaleString("en-IN")}`
}

/** 0.98731 -> "98.7%"; very high shares keep two decimals so 99.94% doesn't read as 100%. */
export function fmtPct(share: number): string {
  const pct = share * 100
  return pct >= 99.5 && pct < 100 ? `${pct.toFixed(2)}%` : `${pct.toFixed(1)}%`
}

export function riskFamilies(families: Family[]): Family[] {
  return families.filter((f) => f.risk)
}

/** "Universal plate (retort): samak, makhana" -> ["Universal plate (retort)", "samak, makhana"]. */
export function splitName(name: string): [string, string | null] {
  const at = name.indexOf(": ")
  return at < 0 ? [name, null] : [name.slice(0, at), name.slice(at + 2)]
}

/** Why a candidate fails a profile, from the fired rules: the forbidden families, once each. */
export function failReasons(fired: { tag: string }[]): string[] {
  return [...new Set(fired.map((f) => f.tag.replaceAll("_", " ")))]
}
