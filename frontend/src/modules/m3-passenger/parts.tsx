// Pieces both /p and /j use: the boarding-pass header, a step frame with its action pinned
// at the bottom, the meal-code card with a tray-label preview, and the promise page.
import { useQuery } from "@tanstack/react-query"
import { Plane, RotateCw, XCircle } from "lucide-react"
import type { ReactNode } from "react"

import { api, POLL_MS } from "@/lib/api"
import { useFlight } from "@/lib/flight"
import { fmtTime } from "@/lib/format"
import { label } from "@/lib/rules"
import type { Lang, MealPromise, Notification, Passenger } from "@/lib/types"
import { cn } from "@/lib/utils"
import { Button, EmptyState, PromiseSteps, StatusChip } from "@/ui"

import { fill, pick, promiseStatus, s } from "./i18n"
import type { CodeOption } from "./types"

export function tagList(tags: string[], lang: Lang): string {
  return tags.map((t) => (lang === "en" ? label(t, "en").toLowerCase() : label(t, lang))).join(lang === "ja" ? "、" : ", ")
}

const OR: Record<Lang, string> = { en: " or ", hi: " या ", ja: "または" }

/** "chicken or fish": for what a wrong code contains. */
export function orList(tags: string[], lang: Lang): string {
  const words = tags.map((t) => (lang === "en" ? label(t, "en").toLowerCase() : label(t, lang)))
  if (words.length < 2) return words.join("")
  return `${words.slice(0, -1).join(lang === "ja" ? "、" : ", ")}${OR[lang]}${words[words.length - 1]}`
}

function Fact({ name, value, mono }: { name: string; value: ReactNode; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-medium uppercase tracking-wider text-grey">{name}</dt>
      <dd className={cn("mt-0.5 truncate text-sm font-semibold text-navy tabular", mono && "font-mono")}>{value}</dd>
    </div>
  )
}

const LOCALE: Record<Lang, string> = { en: "en-GB", hi: "hi-IN", ja: "ja-JP" }

/** "25 Oct", "25 अक्टू॰", "10月25日": the departure date in Delhi time. */
function flightDate(iso: string, lang: Lang): string {
  return new Intl.DateTimeFormat(LOCALE[lang], { day: "numeric", month: "short", timeZone: "Asia/Kolkata" }).format(new Date(iso))
}

/** JL740 as a boarding pass. Before lookup it shows the flight only. */
export function BoardingPass({ passenger, code, lang }: { passenger?: Passenger | null; code?: string | null; lang: Lang }) {
  const { data: flight } = useFlight()
  const name = passenger ? (passenger.display_name ?? `${passenger.surname}/${passenger.given}`) : null
  return (
    <article lang={lang} className="overflow-hidden rounded-[10px] border border-line bg-card">
      <div className="flex items-center justify-between gap-3 px-4 pt-3 pb-2">
        <div>
          <div className="font-display text-2xl font-bold tracking-tight text-navy">{flight?.origin ?? "DEL"}</div>
          <div className="text-xs text-grey tabular">{flight ? fmtTime(flight.std, "IST") : "04:35 IST"}</div>
        </div>
        <div className="flex flex-1 items-center gap-2 text-sky" aria-hidden="true">
          <span className="h-px flex-1 border-t border-dashed border-line" />
          <Plane className="size-4" />
          <span className="h-px flex-1 border-t border-dashed border-line" />
        </div>
        <div className="text-right">
          <div className="font-display text-2xl font-bold tracking-tight text-navy">{flight?.dest ?? "NRT"}</div>
          <div className="text-xs text-grey tabular">{flight ? fmtTime(flight.sta, "JST") : "15:20 JST"}</div>
        </div>
      </div>
      <dl className="grid grid-cols-4 gap-3 border-t border-dashed border-line bg-ice/50 px-4 py-2.5">
        <Fact name={pick(s.pass.flight, lang)} value={flight?.flight_no ?? "JL740"} />
        <Fact name={pick(s.pass.date, lang)} value={flightDate(flight?.std ?? "2026-10-25T04:35:00+05:30", lang)} />
        <Fact name={pick(s.pass.seat, lang)} value={passenger?.seat ?? "--"} />
        <Fact name={pick(s.pass.meal, lang)} value={code ?? passenger?.ssr_meal ?? pick(s.pass.mealUnknown, lang)} mono />
      </dl>
      {name && (
        <div className="border-t border-line px-4 py-2 text-sm text-grey">
          {pick(s.pass.passenger, lang)} <span className="font-medium text-navy">{name}</span>
          {passenger && !passenger.is_judge && <span className="ml-2 font-mono text-navy">{passenger.pnr}</span>}
        </div>
      )}
    </article>
  )
}

/** One step of the flow: title, body, and the primary action pinned to the bottom of the phone. */
export function Step({
  lang,
  n,
  total,
  title,
  sub,
  children,
  action,
}: {
  lang: Lang
  n?: number
  total?: number
  title: string
  sub?: string
  children: ReactNode
  action?: ReactNode
}) {
  return (
    <section lang={lang} className="mt-5">
      {n && total && <p className="text-xs font-medium text-grey tabular">{fill(s.common.step, lang, { n, total })}</p>}
      <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight text-navy">{title}</h1>
      {sub && <p className="mt-1 text-grey">{sub}</p>}
      <div className="mt-4">{children}</div>
      {action && (
        <div className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-mist">
          <div className="mx-auto flex max-w-md gap-2 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">{action}</div>
        </div>
      )}
    </section>
  )
}

export function ErrorBox({ lang, message, onRetry }: { lang: Lang; message?: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col gap-2 rounded-[10px] border border-unsafe/30 bg-unsafe-bg p-3 text-sm text-unsafe">
      <p className="flex gap-2 font-medium">
        <XCircle aria-hidden="true" className="mt-px size-4 shrink-0" />
        {message ?? pick(s.common.error, lang)}
      </p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="self-start">
          <RotateCw /> {pick(s.common.retry, lang)}
        </Button>
      )}
    </div>
  )
}

/** The tray label the caterer prints: the big diet mark comes first, the code second. */
export function TrayLabel({ mark, code, note, name, pnr, lang }: { mark: string; code: string; note: string | null; name: string; pnr?: string; lang: Lang }) {
  return (
    <div lang={lang} className="rounded-md border-2 border-navy bg-paper p-3">
      <div className="font-display text-xl leading-tight font-bold text-navy">{mark}</div>
      <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
        <span className="font-mono font-semibold text-navy">{code}</span>
        {note && <span className="font-mono text-navy">{note}</span>}
      </div>
      <div className="mt-2 flex justify-between border-t border-line pt-2 text-xs text-grey">
        <span className="truncate">{name}</span>
        {pnr && <span className="font-mono">{pnr}</span>}
      </div>
    </div>
  )
}

/** A meal-code option: code, kitchen note, what it loses, and (when chosen) the tray label. */
export function CodeCard({
  option,
  chosen,
  onChoose,
  lang,
  name,
  pnr,
}: {
  option: CodeOption
  chosen: boolean
  onChoose?: () => void
  lang: Lang
  name: string
  pnr?: string
}) {
  return (
    <div
      className={cn(
        "rounded-[10px] border bg-card p-4 transition-colors duration-150",
        chosen ? "border-blue ring-1 ring-blue" : "border-line",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-mono text-2xl font-bold text-navy">{option.code}</div>
          <p className="mt-1 text-sm text-grey">{pick(option.why, lang)}</p>
        </div>
        {option.recommended && <StatusChip status="safe" size="sm" label={pick(s.result.recommended, lang)} />}
      </div>
      <dl className="mt-3 text-sm">
        <dt className="text-grey">{pick(s.result.kitchenNote, lang)}</dt>
        <dd className="font-mono font-semibold text-navy">{option.kitchen_note ?? pick(s.result.noNote, lang)}</dd>
      </dl>
      {option.preference_losses.length > 0 && (
        <p className="mt-3">
          <StatusChip
            status="warn"
            size="sm"
            className="h-auto py-1 whitespace-normal"
            label={fill(s.result.loses, lang, { list: tagList(option.preference_losses, lang) })}
          />
        </p>
      )}
      {chosen ? (
        <div className="mt-4">
          <p className="mb-1.5 text-xs font-medium text-grey">{pick(s.result.trayLabel, lang)}</p>
          <TrayLabel mark={pick(option.label_mark, lang)} code={option.code} note={option.kitchen_note} name={name} pnr={pnr} lang={lang} />
        </div>
      ) : (
        onChoose && (
          <Button variant="outline" className="mt-4 min-h-11 w-full" onClick={onChoose}>
            {fill(s.result.choose, lang, { code: option.code })}
          </Button>
        )
      )}
    </div>
  )
}

/** "Your meal promise": the code we hold for you and the latest updates about it. */
export function PromiseView({ passenger, promise, lang, children }: { passenger: Passenger; promise: MealPromise; lang: Lang; children?: ReactNode }) {
  const notes = useQuery({
    queryKey: ["notifications", passenger.id],
    queryFn: () => api.get<Notification[]>(`/notifications?to=${encodeURIComponent(passenger.id)}`),
    refetchInterval: POLL_MS,
  })
  const promiseNow = useQuery({
    queryKey: ["promise", passenger.id],
    queryFn: async () => {
      const rows = await api.get<(Passenger & { promise?: MealPromise })[]>(`/flights/${passenger.flight_id}/passengers?with_promises=true`)
      return rows.find((r) => r.id === passenger.id)?.promise ?? promise
    },
    refetchInterval: POLL_MS,
    initialData: promise,
  })
  const live = promiseNow.data
  const name = passenger.display_name ?? `${passenger.surname}/${passenger.given}`

  return (
    <div className="flex flex-col gap-4">
      <TrayLabel mark={pick(live.label_mark, lang)} code={live.code} note={live.kitchen_note} name={name} pnr={passenger.is_judge ? undefined : passenger.pnr} lang={lang} />
      <PromiseStatus promise={live} lang={lang} />
      <section>
        <h2 className="mb-2 font-display text-lg font-semibold text-navy">{pick(s.promise.handoffs, lang)}</h2>
        <PromiseSteps checkpoints={live.checkpoints} orientation="column" lang={lang} />
      </section>
      {children}
      <section>
        <h2 className="mb-2 font-display text-lg font-semibold text-navy">{pick(s.promise.updates, lang)}</h2>
        {notes.isError ? (
          <ErrorBox lang={lang} onRetry={() => notes.refetch()} />
        ) : notes.isPending ? (
          <div className="h-16 animate-pulse rounded-[10px] bg-ice" />
        ) : notes.data.length === 0 ? (
          <EmptyState title={pick(s.promise.empty, lang)} />
        ) : (
          <ul className="flex flex-col gap-2">
            {notes.data.map((n) => (
              <li key={n.id} className="rounded-[10px] border border-line bg-card p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-medium text-navy">{n.title}</span>
                  <span className="shrink-0 text-xs text-grey tabular">{fmtTime(n.at, "IST")}</span>
                </div>
                <p className="mt-1 text-sm text-grey">{n.body}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

const PROMISE_STATUS = {
  ok: "safe",
  fixed: "safe",
  at_risk: "warn",
  broken: "unsafe",
} as const

function PromiseStatus({ promise, lang }: { promise: MealPromise; lang: Lang }) {
  return (
    <div className="flex items-center justify-between rounded-[10px] border border-line bg-card px-3 py-2">
      <span className="text-sm text-grey">{pick(s.promise.statusLabel, lang)}</span>
      <StatusChip status={PROMISE_STATUS[promise.status]} label={pick(promiseStatus[promise.status], lang)} />
    </div>
  )
}
