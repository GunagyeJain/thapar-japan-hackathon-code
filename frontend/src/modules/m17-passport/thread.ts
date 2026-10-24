// Chat logic with no React in it, so it is easy to test: chip groups, the live thread from notifications,
// the booking parser, tiers (a port of service.tier_for) and the DietPicker round trip.
import { paths } from "@/lib/rules"
import type { Notification, Text } from "@/lib/types"
import type { DietValue } from "@/modules/m3-passenger/types"

import type { Chip, RadarOption, Rules, Tier } from "./types"

// Same roots as backend/app/modules/m17_passport/service.py: religion or ethics → hard; sugar → firm (medical).
const HARD_ROOTS = new Set([
  "meat", "seafood", "egg", "gelatin", "alcohol", "allium", "root_veg", "fungi", "honey", "dairy",
  "beef", "pork", "non_halal_meat", "lard", "meat_extract", "grain", "legume",
])
const FIRM_ROOTS = new Set(["sugar"])
const TIER_ORDER: Record<Tier, number> = { hard: 3, firm: 2, soft: 1 }

export function tierFor(tag: string, allergens: readonly string[] = []): Tier {
  if (allergens.includes(tag)) return "hard"
  const ancestors = [...paths(tag).keys()]
  if (ancestors.some((a) => HARD_ROOTS.has(a))) return "hard"
  if (ancestors.some((a) => FIRM_ROOTS.has(a))) return "firm"
  return "soft"
}

export type ChipGroup = "never" | "medical" | "prefer" | "allergy" | "fine"
export const CHIP_GROUPS: ChipGroup[] = ["never", "medical", "prefer", "allergy", "fine"]

export function chipGroup(chip: Chip): ChipGroup {
  if (chip.kind === "allow") return "fine"
  if (chip.kind === "allergen") return "allergy"
  if (chip.tier === "firm") return "medical"
  if (chip.tier === "soft") return "prefer"
  return "never"
}

export function groupChips(chips: readonly Chip[]): Record<ChipGroup, Chip[]> {
  const out: Record<ChipGroup, Chip[]> = { never: [], medical: [], prefer: [], allergy: [], fine: [] }
  for (const chip of chips) out[chipGroup(chip)] = [...out[chipGroup(chip)], chip]
  return out
}

/** Flex (swap my main for miles) is only offered when no rule is hard. */
export function canFlex(rules: Pick<Rules, "tiers">): boolean {
  return !Object.values(rules.tiers).includes("hard")
}

/** The WhatsApp-channel messages to this passenger, oldest first. */
export function chatNotes(notes: readonly Notification[]): Notification[] {
  return notes
    .filter((n) => n.channel === "whatsapp")
    .toSorted((a, b) => (a.at === b.at ? a.id.localeCompare(b.id) : a.at < b.at ? -1 : 1))
}

/** Messages the thread hasn't shown yet, in the order they were sent. */
export function freshNotes(shown: ReadonlySet<string>, notes: readonly Notification[]): Notification[] {
  return chatNotes(notes).filter((n) => !shown.has(n.id))
}

export interface RadarQuestionRef {
  kind: "radar_question"
  question_id: string
  options: RadarOption[]
  question?: Text
  date?: string
  flight_no?: string
}

export function radarQuestion(note: Notification): RadarQuestionRef | null {
  const ref = note.ref as Partial<RadarQuestionRef>
  if (ref.kind !== "radar_question" || typeof ref.question_id !== "string" || !Array.isArray(ref.options)) return null
  return ref as RadarQuestionRef
}

/** question id → the option the passenger picked, from the Radar's replies in the thread. */
export function answeredQuestions(notes: readonly Notification[]): Map<string, string> {
  const out = new Map<string, string>()
  for (const n of notes) {
    const ref = n.ref as { kind?: string; question_id?: string; option_id?: string }
    if (ref.kind === "radar_answer" && ref.question_id && ref.option_id) out.set(ref.question_id, ref.option_id)
  }
  return out
}

/** "6XK2QP SHARMA", "sharma 6xk2qp", "PNR 6XK2QP, surname Sharma" → {pnr, surname}; null when it isn't a booking. */
export function parseBooking(text: string): { pnr: string; surname: string } | null {
  const words = text
    .toUpperCase()
    .split(/[\s,;/]+/)
    .filter((w) => w && !["PNR", "SURNAME", "NAME", "BOOKING", "REF", "REFERENCE"].includes(w))
  const sixes = words.filter((w) => /^[A-Z0-9]{6}$/.test(w))
  // A reference with a digit is unmistakable; an all-letter one only counts when the message is just two words.
  const pnr = sixes.find((w) => /\d/.test(w)) ?? (words.length === 2 ? sixes[0] : undefined)
  const surname = words.find((w) => w !== pnr && /^[A-Z][A-Z'-]+$/.test(w))
  return pnr && surname ? { pnr, surname } : null
}

/** The DietPicker's value for these rules: allergies apart, ticked diets from the words we read. */
export function pickerFromRules(rules: Rules, presets: readonly string[]): DietValue {
  return {
    presets: [...presets],
    forbid: rules.forbid.filter((t) => !rules.allergens.includes(t)),
    allow: [...rules.allow],
    allergens: [...rules.allergens],
  }
}

const covers = (general: string, specific: string) => paths(specific).has(general)

/** Rules after the passenger changed them in the picker. Tiers stay for tags they kept; time rules stay as they are. */
export function rulesFromPicker(value: DietValue, base: Rules): Rules {
  const allergens = [...new Set(value.allergens ?? [])]
  const forbid = [...new Set([...value.forbid, ...allergens])]
  const allow = value.allow.filter((a) => !forbid.some((f) => covers(f, a)))
  const tiers: Record<string, Tier> = {}
  for (const tag of forbid) tiers[tag] = allergens.includes(tag) ? "hard" : (base.tiers[tag] ?? tierFor(tag, allergens))
  return { ...base, forbid, allow, allergens, tiers, flex: base.flex && !Object.values(tiers).includes("hard") }
}

/** Chips for rules the passenger edited: words we read keep their "via"; new ones say "you chose this" (empty via). */
export function chipsFor(rules: Rules, previous: readonly Chip[]): Chip[] {
  const before = new Map(previous.map((c) => [`${c.kind}:${c.tag}`, c]))
  const chip = (tag: string, kind: Chip["kind"], tier: Tier | null): Chip => {
    const old = before.get(`${kind}:${tag}`)
    return { tag, kind, tier, via: old?.via ?? "", source: old?.source ?? "dictionary" }
  }
  return [
    ...rules.forbid.map((t) => chip(t, rules.allergens.includes(t) ? "allergen" : "forbid", rules.tiers[t] ?? "hard")),
    ...rules.allow.map((t) => chip(t, "allow", null)),
  ]
}

/** The strongest tier among the rules, for the summary line. */
export function strictest(rules: Pick<Rules, "tiers">): Tier | null {
  const tiers = Object.values(rules.tiers)
  return tiers.length ? tiers.reduce((a, b) => (TIER_ORDER[b] > TIER_ORDER[a] ? b : a)) : null
}

/** The link a travel companion opens to tell us their own food rules. */
export function shareLink(origin: string, pnr: string, surname: string): string {
  return `${origin}/chat?pnr=${encodeURIComponent(pnr)}&surname=${encodeURIComponent(surname)}`
}
