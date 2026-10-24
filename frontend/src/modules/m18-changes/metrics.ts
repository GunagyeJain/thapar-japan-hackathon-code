// ThaliBento vs today's process: the numbers behind the metrics strip. No React here, so it is easy to test.
import type { Status } from "@/ui"

import type { ChangeEvent, Metrics, MetricsResponse, Tier } from "./types"

const TIER_RANK: Record<Tier, number> = { soft: 1, firm: 2, hard: 3 }

/** The strongest tier among a request's rules, or "none" when it forbids nothing. */
export function strictestTier(tiers: Record<string, Tier> | null | undefined): Tier | "none" {
  const values = Object.values(tiers ?? {})
  if (!values.length) return "none"
  return values.reduce((best, t) => (TIER_RANK[t] > TIER_RANK[best] ? t : best))
}

export interface KnownCounts {
  ours: number
  today: number
  passengers: number
}

/** The same counts the server's /changes/metrics returns, from a list of events (used by the stand-in data). */
export function metricsFromEvents(events: ChangeEvent[], known: KnownCounts): MetricsResponse {
  const base = (knownBeforeCutoff: number): Metrics => ({
    events: events.length,
    hard_total: 0,
    hard_met: 0,
    firm_total: 0,
    firm_met: 0,
    meals_wasted: 0,
    known_before_cutoff: knownBeforeCutoff,
    passengers: known.passengers,
  })
  return events.reduce<MetricsResponse>(
    (acc, e) => {
      const tier = strictestTier(e.request.tiers)
      const add = (m: Metrics, met: boolean): Metrics => ({
        ...m,
        hard_total: m.hard_total + (tier === "hard" ? 1 : 0),
        hard_met: m.hard_met + (tier === "hard" && met ? 1 : 0),
        firm_total: m.firm_total + (tier === "firm" ? 1 : 0),
        firm_met: m.firm_met + (tier === "firm" && met ? 1 : 0),
      })
      // A no-show's fresh meal is wasted unless it is released to someone else.
      const noShow = e.kind === "no_show"
      const ours = add(acc.ours, e.decision.ok)
      const today = add(acc.today, e.today.ok)
      return {
        ours: { ...ours, meals_wasted: ours.meals_wasted + (noShow && !e.decision.ok ? 1 : 0) },
        today: { ...today, meals_wasted: today.meals_wasted + (noShow && !e.today.ok ? 1 : 0) },
      }
    },
    { ours: base(known.ours), today: base(known.today) },
  )
}

/** "4/5", or "—" when there is nothing to count yet. */
export function ratio(met: number, total: number): string {
  return total > 0 ? `${met}/${total}` : "—"
}

export interface KpiView {
  id: "hard" | "firm" | "wasted" | "known"
  label: string
  value: string
  delta: string
  hint: string
  status?: { status: Status; label: string }
}

function metStatus(met: number, total: number): KpiView["status"] {
  if (total === 0) return undefined
  return met === total ? { status: "safe", label: "All met" } : { status: "unsafe", label: `${total - met} not met` }
}

/** The four tiles: hard needs, firm needs, meals thrown away, diets known before the cutoff. */
export function kpiViews({ ours, today }: MetricsResponse): KpiView[] {
  const saved = today.meals_wasted - ours.meals_wasted
  const learned = ours.known_before_cutoff - today.known_before_cutoff
  return [
    {
      id: "hard",
      label: "Hard needs met",
      value: ratio(ours.hard_met, ours.hard_total),
      delta: `today ${ratio(today.hard_met, today.hard_total)}`,
      hint: "Allergy or religion: never bent",
      status: metStatus(ours.hard_met, ours.hard_total),
    },
    {
      id: "firm",
      label: "Firm needs met",
      value: ratio(ours.firm_met, ours.firm_total),
      delta: `today ${ratio(today.firm_met, today.firm_total)}`,
      hint: "Medical, such as diabetic",
      status: metStatus(ours.firm_met, ours.firm_total),
    },
    {
      id: "wasted",
      label: "Meals thrown away",
      value: String(ours.meals_wasted),
      delta: `today ${today.meals_wasted}`,
      hint: "Unused fresh meals; pouches that fly again don't count",
      status: saved > 0 ? { status: "safe", label: `${saved} saved` } : undefined,
    },
    {
      id: "known",
      label: "Diets known before the cutoff",
      value: String(ours.known_before_cutoff),
      delta: `of ${ours.passengers} · today ${today.known_before_cutoff}`,
      hint: "Passengers whose food rules we hold before T-25 h",
      status: learned > 0 ? { status: "info", label: `+${learned} vs today` } : undefined,
    },
  ]
}
