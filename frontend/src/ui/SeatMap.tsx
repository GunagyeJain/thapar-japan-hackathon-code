// B787-8 seat map from Flight.cabins, nose on the left. Each seat can carry a status, a mark and a highlight.
import { cn } from "@/lib/utils"
import type { CabinLayout } from "@/lib/types"
import type { Status } from "@/ui/StatusChip"

export interface SeatInfo {
  status?: Status
  /** 1–3 characters drawn in the seat, e.g. "J" for a judge or "V" for a veg meal. */
  mark?: string
  title?: string
  /** False draws an empty (unbooked) seat. */
  occupied?: boolean
}

export interface SeatMapProps {
  cabins: { C: CabinLayout; Y: CabinLayout }
  seats: Record<string, SeatInfo>
  highlight?: string[]
  onSeatClick?: (seat: string) => void
  size?: "sm" | "md"
  className?: string
}

// Letters run K → A down the map; the aisles sit after H and after D (2-2-2 business, 2-4-2 economy).
const AISLE_AFTER = new Set(["H", "D"])

const TONES: Record<Status, string> = {
  safe: "bg-safe-bg text-safe border-safe/40",
  warn: "bg-warn-bg text-warn border-warn/40",
  unsafe: "bg-unsafe-bg text-unsafe border-unsafe/50",
  info: "bg-ice text-blue border-sky/60 dark:bg-secondary dark:text-sky",
  neutral: "bg-muted text-muted-foreground border-transparent",
}

function rows(cabin: CabinLayout): number[] {
  const [lo, hi] = cabin.rows
  return Array.from({ length: hi - lo + 1 }, (_, i) => lo + i)
}

function Cabin({
  name,
  cabin,
  seats,
  highlight,
  onSeatClick,
  size: seatSize,
}: { name: string; cabin: CabinLayout; size: "sm" | "md" } & Pick<SeatMapProps, "seats" | "highlight" | "onSeatClick">) {
  // Nose on the left: A (the left side of the aircraft) at the bottom, K at the top.
  const letters = [...cabin.letters].reverse()
  const size = seatSize === "md" ? "size-8 text-[11px]" : "size-6 text-[10px]"
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">{name}</span>
      <div className="flex gap-1">
        <div className="flex flex-col gap-1 pr-1">
          {letters.map((l) => (
            <span key={l} className={cn("flex items-center justify-center font-medium text-muted-foreground", size, AISLE_AFTER.has(l) && "mb-3")}>
              {l}
            </span>
          ))}
        </div>
        {rows(cabin).map((row) => (
          <div key={row} className="flex flex-col gap-1">
            {letters.map((l) => {
              const id = `${row}${l}`
              const info = seats[id]
              const occupied = info ? info.occupied !== false : false
              const lit = highlight?.includes(id)
              return (
                <button
                  key={id}
                  type="button"
                  title={info?.title ?? `${id}${occupied ? "" : " · free"}`}
                  aria-label={`Seat ${id}${info?.title ? `: ${info.title}` : ""}`}
                  onClick={onSeatClick ? () => onSeatClick(id) : undefined}
                  disabled={!onSeatClick}
                  className={cn(
                    "flex items-center justify-center rounded-[5px] border font-semibold tabular transition-colors duration-150 disabled:cursor-default",
                    size,
                    occupied ? TONES[info?.status ?? "neutral"] : "border-dashed border-border bg-transparent text-muted-foreground/60",
                    lit && "ring-2 ring-blue ring-offset-1 ring-offset-card",
                    AISLE_AFTER.has(l) && "mb-3",
                  )}
                >
                  {info?.mark ?? ""}
                </button>
              )
            })}
            <span className="mt-0.5 text-center text-[10px] text-muted-foreground tabular">{row}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function SeatMap({ cabins, seats, highlight, onSeatClick, size = "sm", className }: SeatMapProps) {
  return (
    <div className={cn("flex max-w-full min-w-0 gap-6 overflow-x-auto rounded-xl border bg-card p-4", className)}>
      <Cabin name="Business" cabin={cabins.C} seats={seats} highlight={highlight} onSeatClick={onSeatClick} size={size} />
      <Cabin name="Economy" cabin={cabins.Y} seats={seats} highlight={highlight} onSeatClick={onSeatClick} size={size} />
    </div>
  )
}
