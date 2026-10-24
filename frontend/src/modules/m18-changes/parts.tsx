// Small pieces both m18 screens share: the sample-data chip, channel label, rung badge, outcome chips.
import { FlaskConical } from "lucide-react"

import { Badge, StatusChip } from "@/ui"

import { CHANNELS, RUNGS, TIERS } from "./labels"
import type { ChangeEvent, Channel, Rung, Tier } from "./types"
import { outcomeOf } from "./words"

/** Shown while an endpoint isn't on the server yet and the screen runs on mock.ts. */
export function SampleChip({ live }: { live: boolean | undefined }) {
  if (live !== false) return null
  return (
    <span title="The change router isn't on this server yet, so this is the stand-in set from the v2 script. It switches to live data by itself.">
      <StatusChip status="neutral" size="sm" icon={FlaskConical} label="Sample data" />
    </span>
  )
}

export function ChannelLabel({ channel, short = false }: { channel: Channel; short?: boolean }) {
  const c = CHANNELS[channel]
  return (
    <span className="inline-flex items-center gap-1.5" title={c.label}>
      <c.icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      {short ? (c.short ?? c.label) : c.label}
    </span>
  )
}

export function RungBadge({ rung, className }: { rung: Rung; className?: string }) {
  return (
    <Badge variant="outline" className={className}>
      {RUNGS[rung].label}
    </Badge>
  )
}

export function OutcomeChip({
  event,
  side,
  size = "sm",
}: {
  event: Pick<ChangeEvent, "kind" | "decision" | "today">
  side: "ours" | "today"
  size?: "sm" | "md" | "lg"
}) {
  const o = outcomeOf(event, side)
  return <StatusChip size={size} status={o.status} label={o.label} />
}

export function TierBadge({ tier }: { tier: Tier | "none" }) {
  if (tier === "none") return <Badge variant="secondary">No food rules</Badge>
  return (
    <Badge variant="secondary">
      {TIERS[tier].label} · {TIERS[tier].why}
    </Badge>
  )
}
