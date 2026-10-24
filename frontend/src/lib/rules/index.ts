// Rules engine for the browser and the offline crew tablet.
// A line-by-line port of backend/app/modules/m1_rules/engine.py (evaluate and presets);
// shared/rules/vectors.json keeps the two in step, so change both together.
import calendarJson from "@shared/rules/calendar.json"
import codesJson from "@shared/rules/codes.json"
import dietsJson from "@shared/rules/diets.json"
import presetsJson from "@shared/rules/presets.json"
import taxonomyJson from "@shared/rules/taxonomy.json"

export type Lang = "en" | "hi" | "ja"
export type Text = { en: string; hi?: string; ja?: string }
export type Verdict = "SAFE" | "UNSAFE" | "NEEDS_HUMAN"
export type Fired = {
  rule_id: string
  tag: string
  via: string
  effect: Verdict
  message: Text
  diet?: string
}
export type Evaluation = { verdict: Verdict; fired: Fired[] }

export type Tag = {
  id: string
  parent: string | null
  also?: string[]
  kind?: string
  allergen_jp?: string
  labels: Text
  synonyms_ja: string[]
  synonyms_en: string[]
}
export type Diet = { id: string; kind: string; labels: Text; forbid: string[]; allow: string[]; notes?: Text }
export type Preset = { id: string; diet: string; labels: Text; forbid: string[]; allow: string[] }
export type PickerGroup = { id: string; kind: "diet" | "allergen"; jp_class?: string; labels: Text; tags: string[] }
export type Code = { code: string; name: Text; excludes: string[]; may_contain: string[]; contains: string[] }

export type Rules = {
  version: string
  tags: Map<string, Tag>
  synonyms: Map<string, string>
  diets: Map<string, Diet>
  presets: Map<string, Preset>
  pickerGroups: PickerGroup[]
  codes: Code[]
}

const NON_HALAL = "non_halal_meat"
const HALAL_CERTIFIED = "halal_certified"
const MEAT = "meat"

let cached: Rules | null = null
const pathsCache = new Map<string, Map<string, string[]>>()

const dedupe = <T,>(items: Iterable<T>): T[] => [...new Set(items)]

export function loadRules(): Rules {
  if (cached) return cached
  const tagList = taxonomyJson.tags as Tag[]
  const synonyms = new Map<string, string>()
  for (const t of tagList) {
    for (const word of t.synonyms_ja) if (!synonyms.has(word)) synonyms.set(word, t.id)
    for (const word of t.synonyms_en) if (!synonyms.has(word.toLowerCase())) synonyms.set(word.toLowerCase(), t.id)
  }
  cached = {
    version: taxonomyJson.version,
    tags: new Map(tagList.map((t) => [t.id, t])),
    synonyms,
    diets: new Map((dietsJson.diets as Diet[]).map((d) => [d.id, d])),
    presets: new Map((presetsJson.presets as Preset[]).map((p) => [p.id, p])),
    pickerGroups: presetsJson.picker_groups as PickerGroup[],
    codes: codesJson.codes as Code[],
  }
  return cached
}

/** Every ancestor of `tag` (itself included) -> shortest path [tag, ..., ancestor]. */
export function paths(tag: string): Map<string, string[]> {
  const hit = pathsCache.get(tag)
  if (hit) return hit
  const r = loadRules()
  const found = new Map<string, string[]>([[tag, [tag]]])
  const queue = [tag]
  while (queue.length) {
    const node = queue.shift() as string
    const t = r.tags.get(node) as Tag
    for (const next of [...(t.parent ? [t.parent] : []), ...(t.also ?? [])]) {
      if (!found.has(next)) {
        found.set(next, [...(found.get(node) as string[]), next])
        queue.push(next)
      }
    }
  }
  pathsCache.set(tag, found)
  return found
}

/** True when `general` is `specific` or one of its ancestors. */
const covers = (general: string, specific: string) => paths(specific).has(general)

export function label(tag: string, lang: Lang): string {
  const labels = loadRules().tags.get(tag)?.labels
  if (!labels) return tag
  return labels[lang] || labels.en
}

const lower = (tag: string) => label(tag, "en").toLowerCase()

/** Dedupe a forbid/allow list and reject ids that aren't in the taxonomy. */
export function checkTags(tags: readonly string[] | null | undefined): string[] {
  const r = loadRules()
  const list = dedupe(tags ?? [])
  const unknown = list.filter((t) => !r.tags.has(t))
  if (unknown.length) throw new Error(`Unknown tags: ${unknown.join(", ")}`)
  return list
}

/** A dish tag, or a Japanese/English ingredient word -> [tag id | null, matched by synonym]. */
export function resolve(raw: string): [string | null, boolean] {
  const r = loadRules()
  const word = raw.trim()
  if (r.tags.has(word)) return [word, false]
  const tag = r.synonyms.get(word) ?? r.synonyms.get(word.toLowerCase()) ?? null
  return [tag, tag !== null]
}

function fired(rule_id: string, tag: string, via: string, effect: Verdict, message: Text, diet?: string): Fired {
  return diet ? { rule_id, tag, via, effect, message, diet } : { rule_id, tag, via, effect, message }
}

function msgContains(item: string, hit: string): Text {
  if (item === hit) {
    return { en: `Contains ${lower(hit)}`, ja: `${label(hit, "ja")}を含む`, hi: `इसमें ${label(hit, "hi")} है` }
  }
  return {
    en: `Contains ${lower(item)} (${lower(hit)})`,
    ja: `${label(item, "ja")}（${label(hit, "ja")}）を含む`,
    hi: `इसमें ${label(item, "hi")} (${label(hit, "hi")}) है`,
  }
}

function msgUnclear(item: string, maybe: string): Text {
  return {
    en: `Says only ${lower(item)}; it could be ${lower(maybe)}. Check with the kitchen`,
    ja: `「${label(item, "ja")}」としか分かりません。${label(maybe, "ja")}の可能性があります。キッチンに確認してください`,
    hi: `सिर्फ़ '${label(item, "hi")}' लिखा है; यह ${label(maybe, "hi")} हो सकता है। रसोई से पूछें`,
  }
}

const MSG_HALAL: Text = {
  en: "Meat without halal certification. Check with the kitchen",
  ja: "ハラール認証のない肉です。キッチンに確認してください",
  hi: "बिना हलाल प्रमाणन का मांस। रसोई से पूछें",
}

function msgUnknown(raw: string): Text {
  return {
    en: `Unknown ingredient "${raw}". A person must check it`,
    ja: `不明な原材料「${raw}」。担当者の確認が必要です`,
    hi: `अज्ञात सामग्री "${raw}"। किसी व्यक्ति को जाँचना होगा`,
  }
}

/**
 * Check a dish's tags against a person's forbid list. One fired rule per dish tag, the
 * closest forbidden family first. UNSAFE > NEEDS_HUMAN > SAFE.
 */
export function evaluate(forbidIn: readonly string[], tags: readonly string[], diet?: string): Evaluation {
  const r = loadRules()
  const forbid = checkTags(forbidIn)
  const forbidden = new Set(forbid)
  const items = dedupe(tags ?? []).map((raw) => [raw, ...resolve(raw)] as const)
  const certified = items.some(([, tag]) => tag === HALAL_CERTIFIED)
  const out: Fired[] = []
  for (const [raw, tag, bySynonym] of items) {
    if (tag === null) {
      out.push(fired("unknown_tag", raw, raw, "NEEDS_HUMAN", msgUnknown(raw), diet))
      continue
    }
    if (r.tags.get(tag)?.kind === "property") continue
    const p = paths(tag)
    const head = bySynonym ? [raw] : []
    const hit = [...p.keys()].find((a) => forbidden.has(a))
    if (hit) {
      const via = [...head, ...(p.get(hit) as string[])].join(" → ")
      out.push(fired(`forbid.${hit}`, hit, via, "UNSAFE", msgContains(tag, hit), diet))
      continue
    }
    const vague = forbid.find((f) => f !== NON_HALAL && f !== tag && covers(tag, f))
    if (vague) {
      const via = [...head, tag].join(" → ")
      out.push(fired(`unclear.${vague}`, vague, via, "NEEDS_HUMAN", msgUnclear(tag, vague), diet))
      continue
    }
    if (forbidden.has(NON_HALAL) && !certified && p.has(MEAT)) {
      const via = [...head, ...(p.get(MEAT) as string[])].join(" → ")
      out.push(fired("halal.certification", NON_HALAL, via, "NEEDS_HUMAN", MSG_HALAL, diet))
    }
  }
  const effects = new Set(out.map((f) => f.effect))
  const verdict: Verdict = effects.has("UNSAFE") ? "UNSAFE" : effects.has("NEEDS_HUMAN") ? "NEEDS_HUMAN" : "SAFE"
  return { verdict, fired: out }
}

/** A MealSpec's tags for evaluate(): `certified` counts as the halal certificate. */
export function specTags(tags: readonly string[], certified = false): string[] {
  return certified && !tags.includes(HALAL_CERTIFIED) ? [...tags, HALAL_CERTIFIED] : [...tags]
}

/** evaluate() with a named diet's forbid list; every fired rule carries the diet id. */
export function evaluateDiet(dietId: string, tags: readonly string[]): Evaluation {
  const diet = loadRules().diets.get(dietId)
  if (!diet) throw new Error(`Unknown diet: ${dietId}`)
  return evaluate(diet.forbid, tags, dietId)
}

/** Presets tapped together -> {forbid, allow}. Allow keeps only what nothing forbids. */
export function combinePresets(presetIds: readonly string[]): { forbid: string[]; allow: string[] } {
  const r = loadRules()
  const unknown = presetIds.filter((p) => !r.presets.has(p))
  if (unknown.length) throw new Error(`Unknown presets: ${unknown.join(", ")}`)
  const picked = dedupe(presetIds).map((p) => r.presets.get(p) as Preset)
  const forbid = dedupe(picked.flatMap((p) => p.forbid))
  const allow = dedupe(picked.flatMap((p) => p.allow)).filter((a) => !forbid.some((f) => covers(f, a)))
  return { forbid, allow }
}

export type FastDay = { date: string; name: Text; alt?: string }
export type Observance = { id: string; labels: Text; rules: string; days: FastDay[] }
export type Calendar = { version: string; note: Text; observances: Observance[] }

/** Public fast-day calendar (Ekadashi, Navratri). Which fasts a person keeps never leaves their phone. */
export function calendar(): Calendar {
  return calendarJson as Calendar
}

/** The given travel dates that fall on a fast day of any of these observances. */
export function fastDays(observanceIds: readonly string[], dates: readonly string[]): string[] {
  const picked = calendar().observances.filter((o) => observanceIds.includes(o.id))
  const days = new Set(picked.flatMap((o) => o.days.map((d) => d.date)))
  return dates.map((d) => d.slice(0, 10)).filter((d) => days.has(d))
}

/** A person's rules on one date: on a fast day the vrat preset is added. Forbid wins, as in combinePresets. */
export function rulesOn(
  forbid: readonly string[],
  allow: readonly string[],
  fastingDates: readonly string[],
  onDate: string,
): { forbid: string[]; allow: string[]; fast_day: boolean } {
  const day = onDate.slice(0, 10)
  if (!fastingDates.some((d) => d.slice(0, 10) === day)) return { forbid: [...forbid], allow: [...allow], fast_day: false }
  const vrat = loadRules().presets.get("vrat") as Preset
  const outForbid = dedupe([...forbid, ...vrat.forbid])
  const outAllow = dedupe([...allow, ...vrat.allow]).filter((a) => !outForbid.some((f) => covers(f, a)))
  return { forbid: outForbid, allow: outAllow, fast_day: true }
}
