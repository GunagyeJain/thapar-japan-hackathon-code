// Seat scan: seat + tray → full-screen green or red with the rule in Japanese and English → C5.
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react"
import { useCallback, useMemo, useState, type FormEvent } from "react"

import type { CrewEvent, CrewPackage } from "@/lib/offline/types"
import { label } from "@/lib/rules"
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

  const seatId = seat.trim().toUpperCase()
  const quick = useMemo(
    () =>
      pkg.passengers
        .filter((p) => pkg.forbid[p.id])
        .map((p) => p.seat)
        .sort((x, y) => parseInt(x) - parseInt(y) || x.localeCompare(y)),
    [pkg],
  )

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="flex flex-col gap-4 rounded-xl border bg-card p-5">
        <Bi text={COPY.step1} size="lg" />
        <label className="flex items-center gap-3">
          <Bi text={COPY.seat} size="sm" inline />
          <Input value={seat} onChange={(e) => onSeat(e.target.value.toUpperCase())} className="h-14 w-32 font-display text-3xl font-bold tabular md:text-3xl" maxLength={3} />
        </label>
        <div>
          <Bi text={COPY.specialSeats} size="sm" className="mb-2 text-muted-foreground" />
          <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto">
            {quick.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => onSeat(q)}
                className={cn(
                  "h-10 min-w-12 rounded-md border px-2 text-sm font-semibold tabular transition-colors duration-150",
                  q === seatId ? "border-blue bg-blue text-primary-foreground" : "border-border bg-muted hover:border-sky",
                )}
              >
                {q}
              </button>
            ))}
          </div>
        </div>
        <PassengerCard pkg={pkg} seat={seatId} />
      </section>

      <form onSubmit={onSubmit} className="flex flex-col gap-4 rounded-xl border bg-card p-5">
        <Bi text={COPY.step2} size="lg" />
        <Camera onCode={check} />
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
        <Button type="submit" size="lg" className="h-14 text-lg" disabled={!code.trim() || !seatId}>
          {say(COPY.check)}
        </Button>
        {problem && <StatusChip status="warn" label={say(problem)} />}
      </form>
      {result && <ResultScreen result={result} onNext={() => setResult(null)} />}
    </div>
  )
}

/** Who sits there and what they can't eat, so crew know before they scan. */
function PassengerCard({ pkg, seat }: { pkg: CrewPackage; seat: string }) {
  const mode = useCrewLang()
  const say = useSay()
  const pax = pkg.passengers.find((p) => p.seat === seat)
  if (!pax) return <StatusChip status="neutral" label={say(COPY.noSeat)} />
  const promise = pkg.promises.find((p) => p.passenger_id === pax.id)
  const forbid = pkg.forbid[pax.id]?.forbid ?? []
  const tagLang = mode === "en" ? "en" : "ja"
  const cantEat = forbid.map((t) => label(t, tagLang)).join(tagLang === "ja" ? "、" : ", ")
  const mark = promise?.label_mark
  return (
    <div className="rounded-lg border border-border bg-background/40 p-4">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-display text-lg font-semibold">{pax.display_name ?? `${pax.surname}/${pax.given} ${pax.title}`}</span>
        {(promise?.code ?? pax.ssr_meal) && <span className="code rounded bg-muted px-1.5 py-0.5 text-sm font-semibold">{promise?.code ?? pax.ssr_meal}</span>}
      </div>
      {mark && <p className="mt-1 font-medium">{say({ ja: mark.ja ?? mark.en, en: mark.en })}</p>}
      <dl className="mt-2 text-sm">
        <dt className="text-muted-foreground">{say(COPY.cantEat)}</dt>
        <dd>{cantEat || say(COPY.noDiet)}</dd>
      </dl>
    </div>
  )
}
