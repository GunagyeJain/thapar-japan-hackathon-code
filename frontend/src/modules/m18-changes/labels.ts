// Staff-facing words for windows, rungs, channels and kinds, in plain operational English (docs/plan/v2.md).
// Passenger-facing strings live in i18n.ts.
import {
  ClipboardCheck,
  DoorOpen,
  MessageCircle,
  PlaneTakeoff,
  Radar,
  Rss,
  Sofa,
  UsersRound,
  type LucideIcon,
} from "lucide-react"

import type { ChangeKind, Channel, Rung, Tier, Window } from "./types"

export const WINDOW_ORDER: Window[] = ["ssr", "caterer_list", "standby_uplift", "airport", "onboard", "inflight"]

export const WINDOWS: Record<Window, { name: string; phrase: string }> = {
  ssr: { name: "Special-meal request", phrase: "Before the cutoff · a proper special meal can still be booked" },
  caterer_list: { name: "Caterer list", phrase: "Past the cutoff · the caterer still takes additions" },
  standby_uplift: { name: "Standby uplift", phrase: "Final list sent · the caterer's standby bank can still go out" },
  airport: { name: "Airport", phrase: "Trucks have left · lounge or what's on board" },
  onboard: { name: "On board", phrase: "Boarding · only what's on board" },
  inflight: { name: "In flight", phrase: "In flight · crew serve from what's on board" },
}

/** Rungs per window, in the order the router tries them (docs/plan/v2.md, "Time windows"). */
const ONBOARD: Rung[] = ["onboard_spare", "noshow_release", "reserve_pouch", "flex_swap", "sunrise_box"]
export const WINDOW_RUNGS: Record<Window, Rung[]> = {
  ssr: ["ssr_change"],
  caterer_list: ["caterer_add"],
  standby_uplift: ["standby_uplift", ...ONBOARD],
  airport: ["lounge", "airside_partner", ...ONBOARD],
  onboard: ONBOARD,
  inflight: ONBOARD,
}
export const ONBOARD_RUNGS: readonly Rung[] = ONBOARD

export const RUNGS: Record<Rung, { label: string; ladder?: string }> = {
  ssr_change: { label: "Special meal (SSR)" },
  caterer_add: { label: "Caterer list add", ladder: "Caterer list" },
  standby_uplift: { label: "Standby uplift", ladder: "Standby stock" },
  lounge: { label: "Lounge meal", ladder: "Lounge (business)" },
  airside_partner: { label: "Airside partner", ladder: "Airside partner" },
  onboard_spare: { label: "Onboard spare", ladder: "Spare on board" },
  noshow_release: { label: "No-show release" },
  reserve_pouch: { label: "Reserve pouch" },
  flex_swap: { label: "Flex swap" },
  sunrise_box: { label: "Sunrise box" },
  unmet: { label: "Not met" },
}

/** Why a rung was passed over, when the server sends only the rung id. */
export const SKIP_REASON: Record<Rung, string> = {
  ssr_change: "Past the special-meal cutoff",
  caterer_add: "The caterer's final list has gone",
  standby_uplift: "Nothing in the standby bank fits, or the trucks have left",
  lounge: "The lounge serves business class only",
  airside_partner: "The airside partner is closed 00:00–05:00",
  onboard_spare: "No spare on board fits these rules",
  noshow_release: "No released meal fits these rules",
  reserve_pouch: "No reserve pouch fits these rules",
  flex_swap: "No flex passenger to swap with",
  sunrise_box: "Not a daylight-only need",
  unmet: "Nothing safe left",
}

export const CHANNELS: Record<Channel, { label: string; short?: string; icon: LucideIcon }> = {
  chat: { label: "Chat", icon: MessageCircle },
  radar: { label: "Radar", icon: Radar },
  checkin: { label: "Check-in", icon: ClipboardCheck },
  lounge: { label: "Lounge", icon: Sofa },
  gate: { label: "Gate", icon: DoorOpen },
  crew: { label: "Crew", icon: UsersRound },
  feed: { label: "Booking feed", short: "Feed", icon: Rss },
  boarding: { label: "Boarding", icon: PlaneTakeoff },
}

export const KINDS: Record<ChangeKind, string> = {
  new_need: "New need",
  mind_change: "Changed their mind",
  lost_request: "Request lost",
  family_member: "For a family member",
  no_show: "No-show",
  calendar: "Fast day",
  run_out: "Ran out",
}

export const TIERS: Record<Tier, { label: string; why: string }> = {
  hard: { label: "Hard", why: "never bent" },
  firm: { label: "Firm", why: "medical" },
  soft: { label: "Soft", why: "taste" },
}

/** Short meal names for the decision headline ("Spare Jain meal · galley 2 · G2-X01"). */
export const CODE_NOUN: Record<string, string> = {
  VJML: "Jain meal",
  AVML: "vegetarian meal",
  DBML: "diabetic meal",
  VGML: "vegan meal",
  VLML: "vegetarian meal",
  MOML: "halal meal",
}

export const GALLEY_WORDS: Record<string, string> = { G1: "galley 1", G2: "galley 2" }
