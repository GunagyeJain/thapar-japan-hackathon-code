// Pure helpers for m21: countdowns, rule labels, degrees, positions and the chart's axes.
import { t } from "@/lib/i18n"
import type { Lang } from "@/lib/types"

import { CITY, fill, s } from "./i18n"
import type { SunRule } from "./types"

const MINUTE_MS = 60_000
const HOUR_MS = 3_600_000
const IST_OFFSET_MS = 5.5 * HOUR_MS

/** "1 h 05 m", or "12 min" under an hour (rounded up to the minute), in the page language. */
export function fmtLeft(ms: number, lang: Lang): string {
  const total = Math.max(0, Math.ceil(ms / MINUTE_MS))
  const h = Math.floor(total / 60)
  const m = total % 60
  return h > 0 ? fill(t(s.durHM, lang), { h, m: String(m).padStart(2, "0") }) : fill(t(s.durM, lang), { m })
}

/** What the rule asks for, never who the person is: "Daylight only, +48 min". */
export function ruleLabel(rule: SunRule, lang: Lang): string {
  if (rule.kind === "fast_dawn_to_sunset") return t(s.ruleFast, lang)
  const wait = rule.after_sunrise_min ?? 0
  return wait > 0 ? fill(t(s.ruleWait, lang), { min: wait }) : t(s.ruleDaylight, lang)
}

export function city(code: string, lang: Lang): string {
  const name = CITY[code]
  return name ? t(name, lang) : code
}

/** "−3.9°", with a real minus sign. */
export function fmtDeg(deg: number, digits = 1): string {
  const text = Math.abs(deg).toFixed(digits)
  return `${deg < 0 && Number(text) !== 0 ? "−" : ""}${text}°`
}

/** "31.7°N 85.8°E" */
export function fmtPosition(lat: number, lon: number): string {
  return `${Math.abs(lat).toFixed(1)}°${lat >= 0 ? "N" : "S"} ${Math.abs(lon).toFixed(1)}°${lon >= 0 ? "E" : "W"}`
}

/** Every whole IST hour between two instants (epoch ms), for the chart's time axis. */
export function istHourTicks(from: number, to: number): number[] {
  const ticks: number[] = []
  const first = Math.ceil((from + IST_OFFSET_MS) / HOUR_MS) * HOUR_MS - IST_OFFSET_MS
  for (let at = first; at <= to; at += HOUR_MS) ticks.push(at)
  return ticks
}

/** [min, max] of the values, rounded outwards to a multiple of `step`. */
export function niceRange(values: number[], step: number): [number, number] {
  return [Math.floor(Math.min(...values) / step) * step, Math.ceil(Math.max(...values) / step) * step]
}
