// Picker state changes and summary chips on the shared rules (the same JSON the server uses).
// No React here, so it is easy to test.
import { label, loadRules, paths, type PickerGroup, type Preset } from "@/lib/rules"
import type { Lang, Text } from "@/lib/types"

import { chip } from "./i18n"
import type { DietValue } from "./types"

const uniq = (xs: string[]) => [...new Set(xs)]

/** True when `general` is `specific` or one of its ancestors (allium covers onion). */
const covers = (general: string, specific: string) => paths(specific).has(general)
const coveredBy = (list: string[], tag: string) => list.some((g) => covers(g, tag))

export const EMPTY_DIET: DietValue = { presets: [], forbid: [], allow: [], allergens: [] }

/** Presets that are really one food ("No beef") live in the food list instead. */
const FOOD_LIKE_PRESETS = new Set(["no_beef", "no_onion_garlic"])

export function presets(): Preset[] {
  return [...loadRules().presets.values()]
}

/** The diets shown under "Do you follow a diet?". */
export function dietPresets(): Preset[] {
  return presets().filter((p) => !FOOD_LIKE_PRESETS.has(p.id))
}

export function pickerGroups(kind: PickerGroup["kind"]): PickerGroup[] {
  return loadRules().pickerGroups.filter((g) => g.kind === kind)
}

const MEATS: PickerGroup[] = [
  { id: "beef", kind: "diet", labels: { en: "Beef", hi: "बीफ़ (गोमांस)", ja: "牛肉" }, tags: ["beef"] },
  { id: "pork", kind: "diet", labels: { en: "Pork", hi: "सूअर का मांस", ja: "豚肉" }, tags: ["pork"] },
  { id: "chicken", kind: "diet", labels: { en: "Chicken", hi: "चिकन", ja: "鶏肉" }, tags: ["chicken"] },
]
const ALL_MEAT: Text = { en: "All meat", hi: "कोई भी मांस", ja: "肉類すべて" }

/** "What can't you eat?": single meats first, then m1's food groups ("Meat" reads "All meat" here). */
export function foodGroups(): PickerGroup[] {
  const groups = pickerGroups("diet").map((g) => (g.id === "meat" ? { ...g, labels: ALL_MEAT } : g))
  const at = groups.findIndex((g) => g.id === "meat")
  return at < 0 ? [...MEATS, ...groups] : [...groups.slice(0, at), ...MEATS, ...groups.slice(at)]
}

function children(tag: string): string[] {
  return [...loadRules().tags.values()].filter((t) => t.parent === tag).map((t) => t.id)
}

/** Stop forbidding `tag` while keeping everything else the person forbids: Jain unticks onion and garlic → allium becomes leek, shallot, ... */
function release(forbid: string[], tag: string): string[] {
  let out = forbid.filter((f) => f !== tag)
  for (const general of out.filter((f) => f !== tag && covers(f, tag))) {
    out = out.filter((f) => f !== general)
    for (const child of children(general)) {
      if (child === tag) continue
      out = covers(child, tag) ? [...out, ...release([child], tag)] : [...out, child]
    }
  }
  return uniq(out)
}

/** A group is ticked when every one of its tags is forbidden, directly or through a parent. */
export function isGroupOn(value: DietValue, group: PickerGroup): boolean {
  return group.tags.every((t) => coveredBy(value.forbid, t))
}

export function toggleGroup(value: DietValue, group: PickerGroup): DietValue {
  if (isGroupOn(value, group)) {
    return { ...value, forbid: group.tags.reduce(release, value.forbid) }
  }
  const forbid = uniq([...value.forbid, ...group.tags])
  return { ...value, forbid, allow: value.allow.filter((a) => !coveredBy(forbid, a)) }
}

/**
 * Tapping a preset ticks its tags. Tapping it again takes back only the tags
 * that no other selected preset needs. Allow keeps only what nothing forbids.
 */
export function togglePreset(value: DietValue, preset: Preset): DietValue {
  const all = loadRules().presets
  if (!value.presets.includes(preset.id)) {
    const forbid = uniq([...value.forbid, ...preset.forbid])
    const allow = uniq([...value.allow, ...preset.allow]).filter((a) => !coveredBy(forbid, a))
    return { ...value, presets: [...value.presets, preset.id], forbid, allow }
  }
  const others = value.presets.filter((id) => id !== preset.id).map((id) => all.get(id)).filter((p): p is Preset => !!p)
  const keepForbid = others.flatMap((p) => p.forbid)
  const keepAllow = others.flatMap((p) => p.allow)
  const forbid = value.forbid.filter((t) => keepForbid.includes(t) || !preset.forbid.includes(t))
  // Another preset's "OK" can come back once this one stops forbidding it (vegan off, vegetarian on: dairy OK).
  const allow = uniq([...value.allow.filter((t) => keepAllow.includes(t) || !preset.allow.includes(t)), ...keepAllow])
  return { ...value, presets: others.map((p) => p.id), forbid, allow: allow.filter((a) => !coveredBy(forbid, a)) }
}

export function toggleAllergen(value: DietValue, group: PickerGroup): DietValue {
  const current = value.allergens ?? []
  const on = group.tags.every((t) => current.includes(t))
  return { ...value, allergens: on ? current.filter((t) => !group.tags.includes(t)) : uniq([...current, ...group.tags]) }
}

export function isAllergenOn(value: DietValue, group: PickerGroup): boolean {
  return group.tags.every((t) => (value.allergens ?? []).includes(t))
}

/** What the server gets: allergies are forbidden too, and kept apart in Profile.allergens. */
export function toRequest(value: DietValue): { presets: string[]; forbid: string[]; allow: string[]; allergens: string[] } {
  const allergens = value.allergens ?? []
  const forbid = uniq([...value.forbid, ...allergens])
  return { presets: value.presets, forbid, allow: value.allow.filter((a) => !coveredBy(forbid, a)), allergens }
}

const CORE = ["meat", "seafood", "egg"]
const LANGS: Lang[] = ["en", "hi", "ja"]

function tagText(tag: string): Text {
  const out: Text = { en: label(tag, "en").toLowerCase() }
  for (const lang of LANGS.slice(1)) out[lang] = label(tag, lang)
  return out
}

export type SummaryChip = { id: string; tone: "no" | "ok" | "allergy"; text: Text }

/** Chips for the summary, e.g. "No meat, fish, egg · No onion or garlic · Dairy OK". */
export function summaryChips(value: DietValue): SummaryChip[] {
  const out: SummaryChip[] = []
  const groups = pickerGroups("diet")
  const on = groups.filter((g) => isGroupOn(value, g))

  const core = on.filter((g) => CORE.includes(g.id))
  if (core.length) out.push({ id: "core", tone: "no", text: chip.noCore(core.map((g) => g.id)) })
  for (const g of on.filter((g) => !CORE.includes(g.id))) {
    out.push({ id: g.id, tone: "no", text: chip.noGroup[g.id] ?? chip.noList([g.labels]) })
  }

  // Forbidden tags the ticked boxes don't already say (gelatin, mushrooms, pork, ...).
  const shown = on.flatMap((g) => g.tags)
  const extra = value.forbid.filter((f) => !coveredBy(shown, f) && !shown.some((s) => covers(f, s)))
  if (extra.length) out.push({ id: "extra", tone: "no", text: chip.alsoNo(extra.map(tagText)) })

  const allergies = pickerGroups("allergen").filter((g) => isAllergenOn(value, g))
  if (allergies.length) out.push({ id: "allergy", tone: "allergy", text: chip.allergy(allergies.map((g) => g.labels)) })

  for (const t of value.allow) {
    if (chip.ok[t] && !coveredBy(value.forbid, t)) out.push({ id: `ok-${t}`, tone: "ok", text: chip.ok[t] })
  }
  return out
}
