// One seat's screen: welcome, the question (Yes · No, skip · Change), the answer, and the safe swaps on board.
// Privacy: initials only; what the meal is shows after a tap, never a diet's name in large text.
import { ArrowLeft, Check, CheckCircle2, Eye, EyeOff, HandPlatter, RefreshCw, Repeat, ScanLine, Undo2, UtensilsCrossed } from "lucide-react"
import { useState, type ReactNode } from "react"

import { ApiError } from "@/lib/api"
import { t } from "@/lib/i18n"
import type { Lang } from "@/lib/types"
import { cn } from "@/lib/utils"
import { Button, EmptyState, StatusChip } from "@/ui"

import { useAnswer, useSeatOptions, useSeatView } from "./api"
import { Frame, TopBar } from "./Frame"
import { SEAT } from "./i18n"
import type { Answer, SeatOption, SeatQuestion } from "./types"

const SOURCE_WORD: Record<SeatOption["source"], typeof SEAT.sourceFreed> = {
  freed: SEAT.sourceFreed,
  spare: SEAT.sourceSpare,
  main: SEAT.sourceMain,
}
const BIG = "h-16 min-w-44 px-7 text-xl [&_svg:not([class*='size-'])]:size-6"

export function SeatScreen({ seat }: { seat: string }) {
  const view = useSeatView(seat)
  const answer = useAnswer(seat)
  const [chosenLang, setLang] = useState<Lang | null>(null)
  const [picking, setPicking] = useState(false)
  const lang = chosenLang ?? view.data?.lang ?? "en"

  const send = (a: Answer, itemId?: string) =>
    answer.mutate({ answer: a, item_id: itemId }, { onSuccess: () => setPicking(false) })

  let body: ReactNode
  const q = view.data?.ask
  if (view.isLoading) body = <div className="h-64 w-full animate-pulse rounded-xl bg-secondary" aria-busy="true" />
  else if (!view.data) body = <Offline lang={lang} onRetry={() => view.refetch()} />
  else if (!view.data.occupied) body = <EmptyState title={t(SEAT.emptySeat, lang)} icon={UtensilsCrossed} />
  else if (!q) body = <Welcome initials={view.data.initials} lang={lang} />
  else if (picking) body = <Options seat={seat} lang={lang} busy={answer.isPending} error={answer.error} onBack={() => setPicking(false)} onChoose={(id) => send("change", id)} />
  else body = <Answered q={q} lang={lang} busy={answer.isPending} onAnswer={send} onPick={() => setPicking(true)} />

  return (
    <Frame>
      <TopBar view={view.data} lang={lang} onLang={setLang} />
      <main className="flex flex-1 flex-col justify-center gap-4 overflow-y-auto p-6 md:px-12 md:py-8">
        {view.isError && view.data && <StatusChip status="warn" label={t(SEAT.offline, lang)} className="self-start" />}
        {answer.isError && !picking && <StatusChip status="warn" label={t(SEAT.failed, lang)} className="self-start" />}
        {body}
      </main>
      <footer className="border-t px-5 py-2.5 text-xs text-muted-foreground md:px-8">{t(SEAT.privacy, lang)}</footer>
    </Frame>
  )
}

function Offline({ lang, onRetry }: { lang: Lang; onRetry: () => void }) {
  return (
    <EmptyState
      title={t(SEAT.offline, lang)}
      action={
        <Button variant="outline" onClick={onRetry}>
          <RefreshCw /> {t(SEAT.open, lang)}
        </Button>
      }
    />
  )
}

function Welcome({ initials, lang }: { initials: string | null; lang: Lang }) {
  return (
    <section className="flex max-w-2xl flex-col gap-3">
      <p className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">{initials}</p>
      <h1 className="font-display text-4xl font-bold md:text-5xl">{t(SEAT.welcome, lang)}</h1>
      <p className="text-lg text-muted-foreground">{t(SEAT.welcomeBody, lang)}</p>
    </section>
  )
}

interface AnsweredProps {
  q: SeatQuestion
  lang: Lang
  busy: boolean
  onAnswer: (a: Answer) => void
  onPick: () => void
}

/** The question, or what the passenger's answer means now. */
function Answered({ q, lang, busy, onAnswer, onPick }: AnsweredProps) {
  const change = (
    <Button size="lg" variant="outline" className={BIG} onClick={onPick} disabled={busy}>
      <Repeat /> {t(SEAT.change, lang)}
    </Button>
  )
  if (q.status === "confirmed" || q.status === "changed") {
    const dish = q.status === "changed" && q.choice?.name ? t(q.choice.name, lang) : null
    return (
      <Outcome icon={CheckCircle2} tone="text-safe" title={dish ? t(SEAT.changedTitle(dish), lang) : t(SEAT.confirmedTitle, lang)} lang={lang}>
        <ScanNote lang={lang} />
        <div className="flex flex-wrap gap-3">{change}</div>
      </Outcome>
    )
  }
  if (q.status === "skipped") {
    return (
      <Outcome icon={HandPlatter} tone="text-sky" title={t(SEAT.skippedTitle, lang)} lang={lang}>
        <p className="text-lg text-muted-foreground">{t(SEAT.skippedBody, lang)}</p>
        <div>
          <Button size="lg" variant="outline" className={BIG} onClick={() => onAnswer("yes")} disabled={busy}>
            <Undo2 /> {t(SEAT.undo, lang)}
          </Button>
        </div>
      </Outcome>
    )
  }
  return (
    <div className="grid items-center gap-8 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <section className="flex flex-col gap-6">
        <p className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">{t(SEAT.eyebrow, lang)}</p>
        <h1 className="flex items-start gap-3 font-display text-4xl leading-tight font-bold md:text-[44px]">
          <CheckCircle2 className="mt-1 size-10 shrink-0 text-safe" aria-hidden="true" />
          <span>{t(q.held === "main" ? SEAT.askMain : SEAT.askSpecial, lang)}</span>
        </h1>
        <div className="flex flex-wrap gap-3">
          <Button size="lg" className={BIG} onClick={() => onAnswer("yes")} disabled={busy}>
            <Check /> {t(SEAT.yes, lang)}
          </Button>
          <Button size="lg" variant="outline" className={BIG} onClick={() => onAnswer("no")} disabled={busy}>
            {t(SEAT.no, lang)}
          </Button>
          {change}
        </div>
        <ScanNote lang={lang} />
        {q.status === "no_answer" && <StatusChip status="info" label={t(SEAT.noAnswerNote, lang)} className="self-start" />}
      </section>
      <MealReveal q={q} lang={lang} />
    </div>
  )
}

function Outcome({ icon: Icon, tone, title, lang, children }: { icon: typeof Check; tone: string; title: string; lang: Lang; children: ReactNode }) {
  return (
    <section className="flex max-w-3xl flex-col gap-5 animate-arrive" lang={lang}>
      <Icon className={cn("size-14", tone)} aria-hidden="true" />
      <h1 className="font-display text-4xl leading-tight font-bold md:text-[44px]">{title}</h1>
      {children}
    </section>
  )
}

function ScanNote({ lang }: { lang: Lang }) {
  return (
    <p className="flex items-center gap-2 text-muted-foreground">
      <ScanLine className="size-5 shrink-0" aria-hidden="true" /> {t(SEAT.scanNote, lang)}
    </p>
  )
}

/** The meal stays hidden until the passenger taps: neighbours see only that a question was asked. */
function MealReveal({ q, lang }: { q: SeatQuestion; lang: Lang }) {
  const [open, setOpen] = useState(false)
  const name = q.meal.name ? t(q.meal.name, lang) : null
  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-background/60 p-5">
      <Button variant="outline" size="lg" className="h-12 self-start" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        {open ? <EyeOff /> : <Eye />} {t(open ? SEAT.hideMeal : SEAT.showMeal, lang)}
      </Button>
      {open && (
        <div className="flex flex-col gap-2 animate-arrive">
          {q.held === "main" && <p className="text-sm text-muted-foreground">{t(SEAT.mealHeld, lang)}</p>}
          {name && <p className="text-lg font-semibold">{name}</p>}
          {q.meal.mark && (
            <p className="text-sm">
              <span className="text-muted-foreground">{t(SEAT.rules, lang)}: </span>
              {t(q.meal.mark, lang)}
            </p>
          )}
          {(q.meal.code || q.meal.item_id) && (
            <p className="code text-xs text-muted-foreground">{[q.meal.code, q.meal.item_id].filter(Boolean).join(" · ")}</p>
          )}
        </div>
      )}
    </section>
  )
}

interface OptionsProps {
  seat: string
  lang: Lang
  busy: boolean
  error: Error | null
  onBack: () => void
  onChoose: (itemId: string) => void
}

function Options({ seat, lang, busy, error, onBack, onChoose }: OptionsProps) {
  const opts = useSeatOptions(seat, true)
  const taken = error instanceof ApiError && error.status === 422
  const back = (
    <Button size="lg" variant="outline" className="h-12 self-start" onClick={onBack}>
      <ArrowLeft /> {t(SEAT.back, lang)}
    </Button>
  )
  if (opts.isLoading) return <div className="h-64 w-full animate-pulse rounded-xl bg-secondary" aria-busy="true" />
  const list = opts.data?.options ?? []
  return (
    <section className="flex flex-col gap-4">
      {back}
      <div>
        <h1 className="font-display text-3xl font-bold">{t(SEAT.changeTitle, lang)}</h1>
        <p className="mt-1 text-muted-foreground">{t(SEAT.changeBody, lang)}</p>
      </div>
      {taken && <StatusChip status="warn" label={t(SEAT.taken, lang)} className="self-start" />}
      {opts.isError && <StatusChip status="warn" label={t(SEAT.offline, lang)} className="self-start" />}
      {opts.data && !opts.data.rules_known && <EmptyState title={t(SEAT.askCrew, lang)} icon={HandPlatter} />}
      {opts.data?.rules_known && list.length === 0 && <EmptyState title={t(SEAT.nothingFits, lang)} icon={UtensilsCrossed} />}
      {list.length > 0 && (
        <ul className="grid gap-3 md:grid-cols-2">
          {list.map((o) => (
            <li key={o.spec_id} className="flex flex-col gap-3 rounded-xl border bg-background/60 p-4">
              <div>
                <p className="text-lg font-semibold">{t(o.name, lang)}</p>
                <p className="text-sm text-muted-foreground">{t(SOURCE_WORD[o.source], lang)}</p>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <StatusChip status="safe" size="sm" label={t(SEAT.fits, lang)} />
                <Button size="lg" className="h-12" disabled={busy} onClick={() => onChoose(o.item_id)}>
                  {t(SEAT.choose, lang)}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
