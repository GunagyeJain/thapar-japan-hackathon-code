// v1, v2, v3…: time (IST), short hash and whether the kitchen acknowledged it.
import { fmtTime } from "@/lib/format"
import { cn } from "@/lib/utils"
import { StatusChip } from "@/ui"
import type { MealListVersion } from "@/modules/m7-caterer/types"

interface VersionListProps {
  versions: MealListVersion[]
  selectedId: string
  onSelect: (id: string) => void
}

export function VersionList({ versions, selectedId, onSelect }: VersionListProps) {
  return (
    <ul className="flex flex-col gap-1" aria-label="Meal list versions">
      {versions.map((v) => (
        <li key={v.id}>
          <button
            type="button"
            onClick={() => onSelect(v.id)}
            aria-current={v.id === selectedId ? "true" : undefined}
            className={cn(
              "flex w-full flex-col gap-1.5 rounded-lg px-3 py-2.5 text-left transition-colors duration-150 hover:bg-ice/60 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
              v.id === selectedId && "bg-ice",
            )}
          >
            <span className="flex items-baseline justify-between gap-2">
              <span className="font-display text-lg font-semibold">v{v.version}</span>
              <span className="text-sm text-muted-foreground tabular">{fmtTime(v.created_at, "IST", { date: true })}</span>
            </span>
            <span className="code text-xs text-muted-foreground">sha256 {v.short_hash}</span>
            {v.ack_at ? (
              <StatusChip size="sm" status="safe" label={`Acknowledged ${fmtTime(v.ack_at, "IST")}`} />
            ) : (
              <StatusChip size="sm" status="warn" label="Waiting for acknowledgement" />
            )}
          </button>
        </li>
      ))}
    </ul>
  )
}
