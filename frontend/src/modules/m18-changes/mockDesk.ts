// Stand-in for the change desk's calls until m17 and m18 are on main: a small router over the seed galley
// (POST /changes), the cabin's passports from the seed bookings (GET /passport/cabin) and a dictionary-only
// reading of free text (POST /passport/understand). Same shapes as shared/api.md.
import itemsJson from "@shared/seed/meal_items.json"
import passengersJson from "@shared/seed/passengers.json"
import specsJson from "@shared/seed/meal_specs.json"

import { combinePresets, evaluate, loadRules, paths, resolve, specTags } from "@/lib/rules"
import type { Lang, MealItem, MealSpec, Passenger, Text } from "@/lib/types"

import { tierFor } from "./desk"
import { ANSWER, fillMessage, MEAL } from "./i18n"
import { WINDOW_RUNGS } from "./labels"
import { windowAt } from "./ladder"
import { MOCK_FLIGHT_ID, mockAdd, mockState, SEGMENTS, specName } from "./mock"
import type { CabinPassenger, CabinResponse, ChangeEvent, Rules, Rung, SubmitChange, UnderstandResponse, Window } from "./types"
import { needSummary } from "./words"

const ITEMS = itemsJson as MealItem[]
const SPECS = specsJson as MealSpec[]
const PASSENGERS = passengersJson as Passenger[]

const CODE_PRESETS: Record<string, string[]> = { VJML: ["jain"], AVML: ["vegetarian"], VGML: ["vegan"], VLML: ["eggetarian"], MOML: ["halal"] }
const NO_PASSPORT = new Set(["PX-0057", "PX-0122", "PX-0109"])
const STANDBY_BANK: { code: string; tags: string[] }[] = [
  { code: "AVML", tags: ["rice", "legume", "yogurt", "onion", "garlic", "ginger", "carrot", "sugar"] },
  { code: "AVML", tags: ["rice", "legume", "yogurt", "onion", "garlic", "ginger", "carrot", "sugar"] },
  { code: "VJML", tags: ["legume", "rice", "wheat", "ghee"] },
  { code: "DBML", tags: ["legume", "spinach", "cauliflower", "wheat"] },
  { code: "VGML", tags: ["legume", "rice", "wheat", "onion", "garlic", "ginger"] },
]
const UNIVERSAL_PLATE = ["spinach", "cauliflower", "fruit", "cumin", "salt"]
const FLEX_MAIN = "SPEC-Y-PANEER"

const title = (s: string): string => s.charAt(0) + s.slice(1).toLowerCase()

function rulesOf(forbid: string[], allow: string[], allergens: string[] = []): Rules {
  return { forbid, allow, allergens, tiers: Object.fromEntries(forbid.map((t) => [t, tierFor(t, allergens)])), flex: false, time_rules: [] }
}

function safe(forbid: string[], tags: string[], certified = false): boolean {
  try {
    return evaluate(forbid, specTags(tags, certified)).verdict === "SAFE"
  } catch {
    return false
  }
}

const covers = (general: string, specific: string): boolean => loadRules().tags.has(specific) && paths(specific).has(general)

/** The first meal code whose exclusions cover every forbidden tag (SPML when none does). */
function bestCode(forbid: string[]): string {
  return loadRules().codes.find((c) => forbid.every((f) => c.excludes.some((e) => covers(e, f))))?.code ?? "SPML"
}

interface Choice {
  rung: Rung
  item?: MealItem
  code?: string | null
  specId?: string | null
  reason: string
  standby?: string
}

type Try = (forbid: string[], cabin: "C" | "Y") => Choice | string

const TRIES: Record<Rung, Try> = {
  ssr_change: (forbid) => ({ rung: "ssr_change", code: bestCode(forbid), reason: "Before the cutoff: booked as a proper special meal" }),
  caterer_add: (forbid) => ({ rung: "caterer_add", code: bestCode(forbid), reason: "Past the cutoff, before the final list: added to the caterer's next list" }),
  standby_uplift: (forbid) => {
    // The bank minus what has gone out: the n-th meal of a code is gone once that code was used n times.
    const used = mockState().standbyUsed
    const left = STANDBY_BANK.filter((b, i) => STANDBY_BANK.slice(0, i + 1).filter((x) => x.code === b.code).length > used.filter((c) => c === b.code).length)
    const fit = left.find((b) => safe(forbid, b.tags))
    if (!fit) return "Nothing in the standby bank fits these rules"
    return { rung: "standby_uplift", code: fit.code, standby: fit.code, reason: `${fit.code} from the caterer's standby bank goes out on the 02:05 truck` }
  },
  lounge: (_forbid, cabin) =>
    cabin === "C" ? { rung: "lounge", reason: "The DEL lounge serves business passengers a safe meal before boarding" } : "The lounge serves business class only",
  airside_partner: () => "The airside partner is closed 00:00–05:00",
  onboard_spare: (forbid, cabin) => {
    const spares = ITEMS.filter((i) => i.kind === "spare" && !mockState().used.includes(i.id))
    const item = spares
      .filter((i) => cabin === "C" || !i.spec_id.startsWith("SPEC-C-"))
      .find((i) => {
        const spec = SPECS.find((s) => s.id === i.spec_id)
        return spec !== undefined && safe(forbid, spec.tags, spec.certified)
      })
    if (!item) return "No spare on board fits these rules"
    const spec = SPECS.find((s) => s.id === item.spec_id)
    return { rung: "onboard_spare", item, code: spec?.code ?? null, specId: item.spec_id, reason: `The spare in ${item.galley === "G1" ? "galley 1" : "galley 2"} fits these rules` }
  },
  noshow_release: () => "No released meal fits these rules",
  reserve_pouch: (forbid) =>
    safe(forbid, UNIVERSAL_PLATE)
      ? { rung: "reserve_pouch", reason: "The universal plate pouch fits these rules; heated on board" }
      : "No reserve pouch fits these rules",
  flex_swap: (forbid) => {
    const spec = SPECS.find((s) => s.id === FLEX_MAIN)
    if (!spec || !safe(forbid, spec.tags)) return "The other main doesn't fit these rules either"
    return { rung: "flex_swap", specId: FLEX_MAIN, reason: "A flex passenger takes the other main for miles; this main fits these rules" }
  },
  sunrise_box: () => "Not a daylight-only need",
  unmet: () => ({ rung: "unmet", reason: "Nothing on board fits these rules" }),
}

function todayFor(window: Window, rung: Rung): [boolean, string] {
  if (window === "ssr") return [true, "Booked as a special meal before the cutoff"]
  if (window === "caterer_list") return [false, "No channel after the cutoff"]
  if (window === "standby_uplift") return [false, "“Too late for a special meal”"]
  if (window === "inflight") return [false, "Crew improvise from the trolley"]
  return rung === "onboard_spare" ? [true, "Crew might find the spare by luck, unchecked"] : [false, "“Tell the crew”: nothing safe found"]
}

function mealText(pick: Choice): Text {
  if (pick.rung === "reserve_pouch") return MEAL.POUCH
  if (pick.rung === "flex_swap") return MEAL.MAIN
  return (pick.code && MEAL[pick.code]) || MEAL.ANY
}

/** Decide a change like the router would, on the seed galley and the stand-in state. */
export function mockSubmit(body: SubmitChange, at: string): ChangeEvent {
  const pax = PASSENGERS.find((p) => p.id === body.passenger_id)
  const rules = body.rules ?? mockCabinRow(pax)?.rules ?? rulesOf([], [])
  const window = windowAt(at, SEGMENTS)
  const cabin = pax?.cabin ?? "Y"
  const tried: { rung: Rung; ok: boolean; reason: string }[] = []
  let pick: Choice | null = null
  for (const rung of [...WINDOW_RUNGS[window], "unmet" as const]) {
    const out = TRIES[rung](rules.forbid, cabin)
    if (typeof out === "string") {
      tried.push({ rung, ok: false, reason: out })
      continue
    }
    pick = out
    tried.push({ rung, ok: true, reason: out.reason })
    break
  }
  const chosen = pick ?? { rung: "unmet" as const, reason: "Nothing on board fits these rules" }
  const seat = pax?.seat ?? "—"
  const [todayOk, todayOutcome] = todayFor(window, chosen.rung)
  const specId = chosen.specId ?? chosen.item?.spec_id ?? null
  const event: ChangeEvent = {
    id: `CH-DESK-${String(mockState().events.length + 1).padStart(2, "0")}`,
    flight_id: MOCK_FLIGHT_ID,
    passenger_id: pax?.id ?? body.passenger_id ?? null,
    seat: pax?.seat ?? null,
    name: pax ? `${title(pax.given)} ${title(pax.surname)}` : null,
    at,
    channel: body.channel,
    kind: body.kind,
    window,
    request: { forbid: rules.forbid, allow: rules.allow, tiers: rules.tiers, note: body.note ?? null, lang: body.lang ?? "en" },
    decision: {
      rung: chosen.rung,
      ok: chosen.rung !== "unmet",
      item_id: chosen.item?.id ?? null,
      spec_id: specId,
      spec_name: specName(specId),
      code: chosen.code ?? null,
      kitchen_note: null,
      reason: { en: chosen.reason },
      steps_tried: tried.map((s) => (s.ok ? s.rung : s)),
    },
    message: fillMessage(ANSWER[chosen.rung], mealText(chosen), seat),
    today: { ok: todayOk, outcome: { en: todayOutcome } },
    status: "done",
  }
  return mockAdd(event, chosen.item ? [chosen.item.id] : [], chosen.standby ? [chosen.standby] : [])
}

function mockCabinRow(p: Passenger | undefined): CabinPassenger | null {
  if (!p) return null
  const presets = p.ssr_meal && !NO_PASSPORT.has(p.id) ? CODE_PRESETS[p.ssr_meal] : undefined
  const combined = presets ? combinePresets(presets) : null
  const rules = combined ? rulesOf(combined.forbid, combined.allow) : null
  const card = (lang: Lang) => (rules ? needSummary(rules, lang) : "")
  return {
    passenger_id: p.id,
    seat: p.seat,
    cabin: p.cabin,
    name: `${title(p.given)} ${title(p.surname)}`,
    known: rules !== null,
    source: rules ? "ssr" : null,
    tier: rules ? "hard" : "none",
    flex: false,
    rules,
    card: { en: card("en"), hi: card("hi"), ja: card("ja") },
  }
}

export function mockCabin(): CabinResponse {
  const passengers = PASSENGERS.map((p) => mockCabinRow(p)).filter((p): p is CabinPassenger => p !== null)
  return { flight_id: MOCK_FLIGHT_ID, known: passengers.filter((p) => p.known).length, total: passengers.length, passengers }
}

// Diet words to the m1 presets they stand for. Food rules only: a word never says who the person is.
const PRESET_WORDS: [RegExp, string][] = [
  [/jain|जैन|ジャイナ/i, "jain"],
  [/vegan|वीगन|ヴィーガン/i, "vegan"],
  [/halal|हलाल|ハラール/i, "halal"],
  [/diabet|sugar|शुगर|मधुमेह|糖尿/i, "diabetic"],
  [/vrat|upvas|fast|व्रत|उपवास|断食/i, "vrat"],
  [/eggetarian/i, "eggetarian"],
  [/\bveg\b|vegetarian|shakahari|शाकाहारी|ベジタリアン|菜食/i, "vegetarian"],
  [/onion|garlic|pyaz|lahsun|प्याज|लहसुन|玉ねぎ|にんにく/i, "no_onion_garlic"],
  [/beef|गोमांस|牛肉/i, "no_beef"],
]

const ALLERGY = /allerg|एलर्जी|アレルギー/i
const FINE = /\b(ok|okay|fine|yes|chalega|chalta)\b|चलेगा|大丈夫/i
const uniq = (xs: string[]): string[] => [...new Set(xs)]
const tagsIn = (words: string[]): string[] => words.map((w) => resolve(w)[0]).filter((t): t is string => t !== null)

/**
 * A dictionary-only reading of what the passenger said: presets by keyword, ingredients by synonym. Each clause
 * decides what its food words mean: an allergy, "is fine", or (by default) a food they don't eat.
 */
export function mockUnderstand(text: string): UnderstandResponse {
  const presets = PRESET_WORDS.filter(([re]) => re.test(text)).map(([, id]) => id)
  const combined = presets.length ? combinePresets(presets) : { forbid: [], allow: [] }
  const clauses = text.split(/[,.;\n]+/).map((c) => ({ text: c, words: c.split(/[\s:!?()/-]+/).filter(Boolean) }))
  const allergens = uniq(clauses.filter((c) => ALLERGY.test(c.text)).flatMap((c) => tagsIn(c.words)))
  const fine = uniq(clauses.filter((c) => !ALLERGY.test(c.text) && FINE.test(c.text)).flatMap((c) => tagsIn(c.words)))
  const avoided = uniq(clauses.filter((c) => !ALLERGY.test(c.text) && !FINE.test(c.text)).flatMap((c) => tagsIn(c.words)))
  const forbid = uniq([...combined.forbid, ...avoided.filter((t) => !fine.includes(t)), ...allergens])
  const rules = rulesOf(forbid, uniq([...combined.allow, ...fine]).filter((a) => !forbid.includes(a)), allergens)
  const words = clauses.flatMap((c) => c.words)
  const tags = tagsIn(words)
  const via = (tag: string) => words.find((w) => resolve(w)[0] === tag) ?? presets.join(", ")
  return {
    rules,
    chips: [
      ...rules.forbid.map((tag) => ({
        tag,
        kind: allergens.includes(tag) ? ("allergen" as const) : ("forbid" as const),
        tier: rules.tiers[tag],
        via: via(tag),
        source: "dictionary" as const,
      })),
      ...rules.allow.map((tag) => ({ tag, kind: "allow" as const, tier: "soft" as const, via: via(tag), source: "dictionary" as const })),
    ],
    time_rules: [],
    unclear: presets.length || tags.length ? [] : words.slice(0, 5),
    source: "dictionary",
  }
}
