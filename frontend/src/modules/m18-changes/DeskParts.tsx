// Change desk pieces: the segmented choice, the passenger finder and the passenger's passport card.
import { useQuery } from "@tanstack/react-query"
import { IdCard, Search, UserRoundX, type LucideIcon } from "lucide-react"
import { useState, type ReactNode } from "react"

import { api, FLIGHT_ID } from "@/lib/api"
import { label } from "@/lib/rules"
import type { Passenger } from "@/lib/types"
import { cn } from "@/lib/utils"
import { Badge, Input, StatusChip } from "@/ui"

import { findPassengers } from "./desk"
import { TIERS } from "./labels"
import { TierBadge } from "./parts"
import type { CabinPassenger, Rules, Tier } from "./types"

export interface SegmentOption<T extends string> {
  value: T
  label: string
  icon?: LucideIcon
}

/** A row of mutually exclusive choices (channel, kind), built like the language switch. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  size = "md",
}: {
  value: T
  options: SegmentOption<T>[]
  onChange: (value: T) => void
  ariaLabel: string
  size?: "sm" | "md"
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="inline-flex flex-wrap gap-0.5 rounded-lg bg-muted p-[3px]">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-3 font-medium text-muted-foreground transition-colors duration-150",
            size === "md" ? "h-11 text-sm" : "h-8 text-xs",
            value === o.value ? "bg-card text-foreground ring-1 ring-border" : "hover:text-foreground",
          )}
        >
          {o.icon && <o.icon className="size-4" aria-hidden="true" />}
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Step({ n, title, children, aside }: { n: number; title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5" aria-label={title}>
      <h2 className="flex flex-wrap items-center gap-2 text-sm font-semibold">
        <span className="flex size-6 items-center justify-center rounded-full bg-navy text-xs text-primary-foreground tabular">{n}</span>
        {title}
        {aside && <span className="ml-auto font-normal">{aside}</span>}
      </h2>
      {children}
    </section>
  )
}

const MAX_QUERY = 30

export function PassengerFinder({ onSelect }: { onSelect: (p: Passenger) => void }) {
  const [query, setQuery] = useState("")
  const passengers = useQuery({
    queryKey: ["flight", FLIGHT_ID, "passengers"],
    queryFn: () => api.get<Passenger[]>(`/flights/${FLIGHT_ID}/passengers`),
  })
  const hits = findPassengers(passengers.data ?? [], query)
  const searching = query.trim().length > 0
  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <Search className="pointer-events-none absolute top-3 left-3 size-4 text-muted-foreground" aria-hidden="true" />
        <Input
          aria-label="Seat, or PNR and surname"
          placeholder="Seat (31K), or PNR and surname (B82HTY MEHTA)"
          className="h-10 pl-9"
          value={query}
          maxLength={MAX_QUERY}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      {passengers.isError && <p className="text-sm text-unsafe">Couldn't load the passenger list: {passengers.error.message}</p>}
      {searching && hits.length === 0 && passengers.data && <p className="text-sm text-muted-foreground">No passenger on JL740 matches “{query.trim()}”.</p>}
      {hits.length > 0 && (
        <ul className="flex flex-col rounded-lg border">
          {hits.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => {
                  onSelect(p)
                  setQuery("")
                }}
                className="flex min-h-11 w-full items-center gap-3 border-t px-3 py-2 text-left text-sm first:border-t-0 hover:bg-ice focus-visible:bg-ice focus-visible:outline-none"
              >
                <span className="w-10 font-semibold tabular">{p.seat}</span>
                <span className="flex-1">
                  {p.surname}/{p.given} {p.title}
                </span>
                <span className="code text-muted-foreground">{p.pnr}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function tierGroups(rules: Rules): [Tier, string[]][] {
  const order: Tier[] = ["hard", "firm", "soft"]
  return order
    .map((tier): [Tier, string[]] => [tier, rules.forbid.filter((tag) => (rules.tiers[tag] ?? "soft") === tier)])
    .filter(([, tags]) => tags.length > 0)
}

/** Who they are, what they booked, and their passport if they have one. */
export function PassengerCard({ passenger: p, passport, loading }: { passenger: Passenger; passport: CabinPassenger | undefined; loading: boolean }) {
  const known = Boolean(passport?.known && passport.rules)
  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-ice/50 p-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
        <span className="font-display text-xl font-semibold tabular">{p.seat}</span>
        <span className="font-medium">
          {p.surname}/{p.given} {p.title}
        </span>
        <span className="code text-muted-foreground">{p.pnr}</span>
        <span className="text-muted-foreground">
          {p.cabin === "C" ? "Business" : "Economy"} · {p.ssr_meal ? `booked ${p.ssr_meal}` : "no special meal booked"}
        </span>
      </div>
      {loading ? (
        <span className="h-5 w-48 animate-pulse rounded bg-muted" aria-label="Loading passport" />
      ) : known && passport?.rules ? (
        <div className="flex flex-col gap-1.5">
          <span className="flex flex-wrap items-center gap-2">
            <StatusChip status="info" size="sm" icon={IdCard} label="Has a dietary passport" />
            <TierBadge tier={passport.tier} />
            {passport.flex && <Badge variant="outline">Flex: will swap for miles</Badge>}
          </span>
          <ul className="flex flex-wrap gap-1.5">
            {tierGroups(passport.rules).map(([tier, tags]) => (
              <li key={tier}>
                <Badge variant="outline" className="h-auto py-1 whitespace-normal">
                  <span className="font-semibold">{TIERS[tier].label}:</span> {tags.map((tag) => label(tag, "en").toLowerCase()).join(", ")}
                </Badge>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <StatusChip status="neutral" size="sm" icon={UserRoundX} label="No food rules on file" />
      )}
    </div>
  )
}
