import type { ReactNode } from "react"

import { cn } from "@/lib/utils"
import { StatusChip, type Status } from "@/ui/StatusChip"

export interface KpiTileProps {
  label: ReactNode
  value: ReactNode
  delta?: ReactNode
  /** One plain line under the number: what it counts. */
  hint?: ReactNode
  status?: { status: Status; label: string }
  className?: string
}

export function KpiTile({ label, value, delta, hint, status, className }: KpiTileProps) {
  return (
    <div className={cn("flex flex-col gap-1 rounded-xl border bg-card p-5", className)}>
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="flex items-baseline gap-2">
        <span className="font-display text-[48px] leading-none font-bold tracking-tight tabular">{value}</span>
        {delta && <span className="text-sm text-muted-foreground tabular">{delta}</span>}
      </div>
      {hint && <div className="text-xs leading-snug text-muted-foreground">{hint}</div>}
      {status && <StatusChip className="mt-2" size="sm" status={status.status} label={status.label} />}
    </div>
  )
}
