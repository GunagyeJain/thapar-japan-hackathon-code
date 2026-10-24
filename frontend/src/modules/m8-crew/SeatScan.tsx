// Seat scan: seat + tray → full-screen green or red with the rule in Japanese and English → C5.
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react"
import { useCallback, useMemo, useState, type FormEvent } from "react"

import type { CrewEvent, CrewPackage } from "@/lib/offline/types"
import type { Verdict } from "@/lib/types"
import { cn } from "@/lib/utils"
import { Button, Input, StatusChip } from "@/ui"
import { Bi } from "@/modules/m8-crew/Bi"
import { Camera } from "@/modules/m8-crew/Camera"
import { COPY, type Bilingual } from "@/modules/m8-crew/i18n"
import { useCrewLang, useSay } from "@/modules/m8-crew/lang"
import { lookup, normaliseCode, verdictFor } from "@/modules/m8-crew/logic"

interface SeatScanProps {
  pkg: CrewPackage
  seat: string
  onSeat: (seat: string) => void
  now: () => string
  record: (event: Omit<CrewEvent, "client_id">) => Promise<void>
}

interface Result {
  verdict: Verdict
  seat: string
  name: string
  itemId: string
  dish: Bilingual
  reasons: Bilingual[]
  note: Bilingual | null
}

const LOOK: Record<Verdict, { icon: typeof CheckCircle2; text: Bilingual; className: string }> = {
  SAFE: { icon: CheckCircle2, text: COPY.safe, className: "bg-safe text-background" },
  UNSAFE: { icon: XCircle, text: COPY.unsafe, className: "bg-unsafe text-background" },
  NEEDS_HUMAN: { icon: AlertTriangle, text: COPY.needsHuman, className: "bg-warn text-background" },
}

/** One block of text in the chosen language: big first line, smaller second line when both are shown. */
function Two({ text, big, small }: { text: Bilingual; big: string; small: string }) {
  const mode = useCrewLang()
  if (mode !== "both") return <span lang={mode} className={cn("block", big)}>{text[mode]}</span>
  return (
    <>
      <span lang="ja" className={cn("block", big)}>{text.ja}</span>
      <span className={cn("block", small)}>{text.en}</span>
    </>
  )
}

function ResultScreen({ result, onNext }: { result: Result; onNext: () => void }) {
  const look = LOOK[result.verdict]
  const say = useSay()
  return (
    <div role="alertdialog" aria-live="assertive" className={cn("fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 p-8 text-center animate-arrive", look.className)}>
      <look.icon className="size-24" aria-hidden="true" />
      <div className="flex flex-col gap-1">
        <Two text={look.text} big="text-5xl font-bold" small="text-2xl opacity-90" />
      </div>
      <div className="font-display text-6xl font-bold tabular">{result.seat}</div>
      <div className="text-lg opacity-90">
        {result.name} · {say(result.dish)} · <span className="code">{result.itemId}</span>
      </div>
      {result.reasons.length > 0 && (
        <ul className="flex flex-col gap-2 rounded-xl bg-black/15 px-6 py-4 text-left">
          {result.reasons.map((r, i) => (
            <li key={i}>
              <Two text={r} big="text-xl font-semibold" small="opacity-90" />
            </li>
          ))}
        </ul>
      )}
      {result.note && (
        <p className="text-lg">
          {say(result.note)}
        </p>
      )}
      <Button size="lg" variant="outline" className="h-14 min-w-48 border-current bg-transparent text-lg text-inherit hover:bg-black/10" onClick={onNext} autoFocus>
        {say(COPY.next)}
      </Button>
    </div>
  )
}

export function SeatScan({ pkg, seat, onSeat, now, record }: SeatScanProps) {
  const say = useSay()
  const L = useMemo(() => lookup(pkg), [pkg])
  const [code, setCode] = useState("")
  const [result, setResult] = useState<Result | null>(null)
  const [problem, setProblem] = useState<Bilingual | null>(null)

  const check = useCallback(
    (raw: string) => {
      const pax = L.bySeat.get(seat.trim().toUpperCase())
      if (!pax) return setProblem(COPY.noSeat)
      const item = L.items.get(normaliseCode(raw))
      if (!item) return setProblem(COPY.unknownCode)
      setProblem(null)
      const spec = L.specs.get(item.spec_id)
      const v = verdictFor(pkg, L, pax.id, item)
      const owner = item.assigned_passenger_id ? L.passengers.get(item.assigned_passenger_id) : undefined
      const theirs = owner && owner.id !== pax.id
      const verdict: Verdict = v.verdict === "SAFE" && theirs ? "NEEDS_HUMAN" : v.verdict
      const reasons = v.fired.map((f) => ({ ja: f.message.ja ?? f.message.en, en: f.message.en }))
      setResult({
        verdict,
        seat: pax.seat,
        name: `${pax.surname}/${pax.given} ${pax.title}`,
        itemId: item.id,
        dish: { ja: spec?.name.ja ?? "", en: spec?.name.en ?? item.spec_id },
        reasons,
        note: theirs ? COPY.notTheirs(owner.seat) : pkg.forbid[pax.id] ? null : COPY.noDiet,
      })
      void record({
        type: "seat_scan",
        item_id: item.id,
        seat: pax.seat,
        passenger_id: pax.id,
        verdict,
        reason: reasons.map((r) => r.en).join("; ") || undefined,
        at: now(),
      })
      setCode("")
    },
    [L, pkg, seat, record, now],
  )

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    check(code)
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_auto]">
      <form onSubmit={onSubmit} className="flex flex-col gap-4 rounded-xl border bg-card p-5">
        <label className="flex flex-col gap-1.5">
          <Bi text={COPY.seat} size="sm" inline />
          <Input value={seat} onChange={(e) => onSeat(e.target.value.toUpperCase())} className="h-14 w-40 font-display text-3xl font-bold tabular md:text-3xl" maxLength={3} />
        </label>
        <label className="flex flex-col gap-1.5">
          <Bi text={COPY.scanOrType} size="sm" inline />
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder={say(COPY.codePlaceholder)}
            className="code h-14 text-2xl uppercase md:text-2xl"
            autoCapitalize="characters"
            autoComplete="off"
          />
        </label>
        <Button type="submit" size="lg" className="h-14 text-lg" disabled={!code.trim() || !seat.trim()}>
          {say(COPY.check)}
        </Button>
        {problem && <StatusChip status="warn" label={say(problem)} />}
      </form>
      <div className="lg:w-[420px]">
        <Camera onCode={check} />
      </div>
      {result && <ResultScreen result={result} onNext={() => setResult(null)} />}
    </div>
  )
}
