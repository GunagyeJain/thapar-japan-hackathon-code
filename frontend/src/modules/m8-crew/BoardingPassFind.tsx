// Seat service, step 1 by boarding pass: scan the pass (paper or phone) or type the booking reference on it,
// and the seat fills in. Works offline: everything is matched in the downloaded package.
import { Search } from "lucide-react"
import { useState, type FormEvent } from "react"

import type { CrewPackage } from "@/lib/offline/types"
import type { Passenger } from "@/lib/types"
import { cn } from "@/lib/utils"
import { Button, Input, StatusChip } from "@/ui"
import { Bi } from "@/modules/m8-crew/Bi"
import { findByPass, type PassMatch } from "@/modules/m8-crew/boardingPass"
import { Camera } from "@/modules/m8-crew/Camera"
import { PASS } from "@/modules/m8-crew/i18n"
import { useSay } from "@/modules/m8-crew/lang"

interface BoardingPassFindProps {
  pkg: CrewPackage
  seat: string
  onSeat: (seat: string) => void
}

const paxName = (p: Passenger): string => p.display_name ?? `${p.surname}/${p.given} ${p.title}`
/** Long bilingual lines wrap instead of running off the panel. */
const WRAP = "h-auto min-h-7 py-1 whitespace-normal"

export function BoardingPassFind({ pkg, seat, onSeat }: BoardingPassFindProps) {
  const say = useSay()
  const [text, setText] = useState("")
  const [match, setMatch] = useState<PassMatch | null>(null)

  const find = (raw: string) => {
    const result = findByPass(pkg.passengers, pkg.flight, raw)
    setMatch(result)
    if (result.kind === "found" && result.passengers.length === 1) onSeat(result.passengers[0].seat)
  }
  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    find(text)
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-dashed border-border p-4">
      <Bi text={PASS.title} size="sm" className="font-semibold" />
      <form onSubmit={onSubmit} className="flex gap-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={say(PASS.placeholder)}
          aria-label={PASS.label.en}
          className="code h-12 flex-1 text-lg uppercase md:text-lg"
          autoCapitalize="characters"
          autoComplete="off"
        />
        <Button type="submit" size="lg" className="h-12" disabled={!text.trim()}>
          <Search /> {say(PASS.find)}
        </Button>
      </form>
      <Camera onCode={find} />
      {match && <MatchView match={match} seat={seat} onSeat={onSeat} />}
    </div>
  )
}

function MatchView({ match, seat, onSeat }: { match: PassMatch; seat: string; onSeat: (seat: string) => void }) {
  const say = useSay()
  if (match.kind === "unreadable") return <StatusChip status="warn" label={say(PASS.unreadable)} className={WRAP} />
  if (match.kind === "not_found") return <StatusChip status="warn" label={say(PASS.notFound)} className={WRAP} />
  if (match.kind === "other_flight") {
    return <StatusChip status="warn" label={say(PASS.otherFlight(`${match.pass.carrier}${match.pass.flight}`))} className={WRAP} />
  }
  const [only] = match.passengers
  const moved = match.pass && match.passengers.length === 1 && match.pass.seat && match.pass.seat !== only.seat
  return (
    <div className="flex flex-col gap-2">
      {match.passengers.length === 1 ? (
        <StatusChip status="safe" label={say(PASS.found(paxName(only), only.seat))} className={WRAP} />
      ) : (
        <>
          <Bi text={PASS.pick} size="sm" className="text-muted-foreground" />
          <div className="flex flex-wrap gap-2">
            {match.passengers.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onSeat(p.seat)}
                aria-pressed={p.seat === seat}
                className={cn(
                  "h-12 rounded-md border px-3 text-sm font-semibold transition-colors duration-150",
                  p.seat === seat ? "border-blue bg-blue text-primary-foreground" : "border-border bg-muted hover:border-sky",
                )}
              >
                {paxName(p)} · <span className="tabular">{p.seat}</span>
              </button>
            ))}
          </div>
        </>
      )}
      {match.rebooked && <StatusChip status="info" label={say(PASS.rebooked)} className={WRAP} />}
      {moved && <StatusChip status="info" label={say(PASS.seatMoved(match.pass!.seat, only.seat))} className={WRAP} />}
    </div>
  )
}
