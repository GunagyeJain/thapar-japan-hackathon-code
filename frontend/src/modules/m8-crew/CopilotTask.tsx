// m20 copilot task: the seat map by strictness or the serve list, and the card for the tapped seat.
// Everything comes from the downloaded package, so it works in airplane mode; taps queue for the next sync.
import { LayoutGrid, ListChecks, type LucideIcon } from "lucide-react"
import { useMemo, useState } from "react"

import { cn } from "@/lib/utils"
import { Dialog, DialogContent, DialogTitle } from "@/ui"
import { Bi } from "@/modules/m8-crew/Bi"
import { serveRows, type CopilotPackage } from "@/modules/m8-crew/copilot"
import { CopilotCard } from "@/modules/m8-crew/CopilotCard"
import { CopilotMap } from "@/modules/m8-crew/CopilotMap"
import type { NewTap } from "@/modules/m8-crew/copilotStore"
import { COPILOT, type Bilingual } from "@/modules/m8-crew/i18n"
import { SeatbackPanel } from "@/modules/m8-crew/SeatbackPanel"
import { ServeList } from "@/modules/m8-crew/ServeList"
import { useSeatbackStatus, type SeatbackRow } from "@/modules/m22-seatback"

type View = "map" | "list"

interface CopilotTaskProps {
  pkg: CopilotPackage
  now: () => string
  onTap: (tap: NewTap) => Promise<void>
  /** Opens seat service for this seat: the scan-to-serve check before a special tray is handed over. */
  onScan: (seat: string) => void
  /** On the cabin network: seat-screen answers (m22) arrive live. */
  online?: boolean
}

const VIEWS: { id: View; icon: LucideIcon; text: Bilingual }[] = [
  { id: "map", icon: LayoutGrid, text: COPILOT.viewMap },
  { id: "list", icon: ListChecks, text: COPILOT.viewList },
]

function Hint({ text }: { text: Bilingual }) {
  return (
    <section className="rounded-xl border border-dashed bg-card/60 p-5">
      <Bi text={text} size="md" />
    </section>
  )
}

export function CopilotTask({ pkg, now, onTap, onScan, online = true }: CopilotTaskProps) {
  const [view, setView] = useState<View>("map")
  const [selected, setSelected] = useState<string | null>(null)
  const seatback = useSeatbackStatus(pkg.flight.id)
  const answers = useMemo(() => new Map<string, SeatbackRow>((seatback.data?.seats ?? []).map((s) => [s.seat, s])), [seatback.data])
  const served = useMemo(() => new Set([...serveRows(pkg).values()].flat().filter((r) => r.done).map((r) => r.seat.seat)), [pkg])
  if (!pkg.copilot) return <Hint text={COPILOT.noCopilot} />

  const pick = (next: View) => {
    setView(next)
    if (next === "map") setSelected(null) // on the map the card opens over it; start from the map itself
  }
  const card = (seat: string) => <CopilotCard pkg={pkg} seat={seat} now={now} onTap={onTap} onScan={onScan} answer={answers.get(seat)} />
  const openSeat = (seat: string) => {
    setView("list")
    setSelected(seat)
  }

  return (
    <div className="flex flex-col gap-4">
      <SeatbackPanel flightId={pkg.flight.id} online={online} status={seatback.data} served={served} onSeat={openSeat} />
      <div role="radiogroup" aria-label="Copilot view" className="flex flex-wrap gap-2">
        {VIEWS.map((v) => {
          const on = v.id === view
          return (
            <button
              key={v.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => pick(v.id)}
              className={cn(
                "flex min-h-12 items-center gap-2 rounded-lg border px-4 py-2 text-left transition-colors duration-150",
                on ? "border-blue bg-secondary ring-1 ring-blue" : "border-border bg-card hover:border-sky",
              )}
            >
              <v.icon className={cn("size-5", on ? "text-blue dark:text-sky" : "text-muted-foreground")} aria-hidden="true" />
              <Bi text={v.text} size="sm" className="font-semibold" />
            </button>
          )
        })}
      </div>
      {view === "map" ? (
        <>
          <CopilotMap pkg={pkg} selected={selected} onSeat={setSelected} />
          <Hint text={COPILOT.pickSeat} />
          <Dialog open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
            <DialogContent className="cabin max-h-[92vh] gap-0 overflow-y-auto border-0 bg-transparent p-0 sm:max-w-3xl" aria-describedby={undefined}>
              <DialogTitle className="sr-only">{selected}</DialogTitle>
              {selected && card(selected)}
            </DialogContent>
          </Dialog>
        </>
      ) : (
        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_420px]">
          <ServeList pkg={pkg} selected={selected} onSeat={setSelected} answers={answers} />
          <div className="lg:sticky lg:top-24">{selected ? card(selected) : <Hint text={COPILOT.pickSeat} />}</div>
        </div>
      )}
    </div>
  )
}
