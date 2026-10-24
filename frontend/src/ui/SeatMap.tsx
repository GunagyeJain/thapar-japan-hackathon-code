// B787-8 seat map from Flight.cabins, nose on the left. Each seat can carry a status, a mark and a highlight.
// variant="plane" draws the seats inside an aircraft outline (nose, wings, tail) with the galleys in place.
import type { ReactNode } from "react"

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

type SeatSize = "xs" | "sm" | "md"

export interface SeatMapProps {
  cabins: { C: CabinLayout; Y: CabinLayout }
  seats: Record<string, SeatInfo>
  highlight?: string[]
  onSeatClick?: (seat: string) => void
  size?: "sm" | "md"
  variant?: "plain" | "plane"
  /** Labels for the galley blocks in the plane outline: between the cabins, and at the rear. */
  galleys?: { front: ReactNode; rear: ReactNode }
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

const SIZES: Record<SeatSize, string> = {
  xs: "size-5 text-[9px]",
  sm: "size-6 text-[10px]",
  md: "size-8 text-[11px]",
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
}: { name: string; cabin: CabinLayout; size: SeatSize } & Pick<SeatMapProps, "seats" | "highlight" | "onSeatClick">) {
  // Nose on the left: A (the left side of the aircraft) at the bottom, K at the top.
  const letters = [...cabin.letters].reverse()
  const size = SIZES[seatSize]
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

function Galley({ children }: { children: ReactNode }) {
  return (
    <div className="flex w-9 shrink-0 flex-col items-center justify-center self-stretch rounded-md border border-dashed border-border bg-muted/40 text-center text-[10px] leading-tight font-semibold text-muted-foreground">
      {children}
    </div>
  )
}

/** A swept wing seen from above, root along the bottom edge. Flip it for the other side. */
function Wing({ className, flip = false, small = false }: { className?: string; flip?: boolean; small?: boolean }) {
  const points = small ? "0,64 64,64 92,6 74,0" : "0,112 190,112 250,8 214,0"
  return (
    <svg viewBox={small ? "0 0 92 64" : "0 0 250 112"} className={cn("pointer-events-none absolute", flip && "-scale-y-100", className)} aria-hidden="true">
      <polygon points={points} className="fill-muted stroke-border" strokeWidth="2" strokeLinejoin="round" />
      {!small && <rect x="60" y="54" width="54" height="18" rx="9" className="fill-card stroke-border" strokeWidth="2" />}
    </svg>
  )
}

function PlaneOutline({ children }: { children: ReactNode }) {
  return (
    <div className="relative mx-auto w-fit py-[104px]">
      <Wing className="top-0 left-[40%] h-[112px] w-[250px]" />
      <Wing className="bottom-0 left-[40%] h-[112px] w-[250px]" flip />
      <Wing className="top-[50px] right-[6px] h-[64px] w-[92px]" small />
      <Wing className="right-[6px] bottom-[50px] h-[64px] w-[92px]" small flip />
      {/* fuselage: round nose on the left, narrower tail on the right */}
      <div className="relative z-10 flex items-center gap-3 rounded-l-[160px] rounded-r-[56px] border-2 border-border bg-card py-5 pr-14 pl-24">
        <svg viewBox="0 0 40 60" className="absolute top-1/2 left-7 h-14 w-9 -translate-y-1/2" aria-hidden="true">
          <path d="M36 6 Q8 14 6 30 Q8 46 36 54" className="fill-none stroke-border" strokeWidth="4" strokeLinecap="round" />
        </svg>
        {children}
      </div>
    </div>
  )
}

export function SeatMap({ cabins, seats, highlight, onSeatClick, size = "sm", variant = "plain", galleys, className }: SeatMapProps) {
  const shared = { seats, highlight, onSeatClick }
  if (variant === "plane") {
    return (
      <div className={cn("max-w-full min-w-0 overflow-x-auto rounded-xl border bg-background/40 px-4", className)}>
        <PlaneOutline>
          <Cabin name="Business" cabin={cabins.C} size="sm" {...shared} />
          <Galley>{galleys?.front ?? "G1"}</Galley>
          <Cabin name="Economy" cabin={cabins.Y} size="xs" {...shared} />
          <Galley>{galleys?.rear ?? "G2"}</Galley>
        </PlaneOutline>
      </div>
    )
  }
  return (
    <div className={cn("flex max-w-full min-w-0 gap-6 overflow-x-auto rounded-xl border bg-card p-4", className)}>
      <Cabin name="Business" cabin={cabins.C} size={size} {...shared} />
      <Cabin name="Economy" cabin={cabins.Y} size={size} {...shared} />
    </div>
  )
}
