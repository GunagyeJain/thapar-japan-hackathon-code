// /demo: the presenter's cockpit. Steps the sim clock through the story and, for each step, says where to look,
// what to click, what to say and what the room should notice. "Do it for me" covers a failed click.
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, ArrowRight, CheckCircle2, ChevronRight, ExternalLink, Eye, Laptop, MessageSquareQuote, RefreshCw, RotateCcw, Smartphone, Tablet, Wand2, type LucideIcon } from "lucide-react"
import { useState } from "react"
import { Link } from "react-router"

import { api } from "@/lib/api"
import { t } from "@/lib/i18n"
import type { Lang } from "@/lib/types"
import { cn } from "@/lib/utils"
import { Button, EmptyState, LangSwitch, PageHeader, PromiseSteps, toast } from "@/ui"
import { BrandToggle } from "@/modules/m11-demo/BrandToggle"
import { usePriya, useScenario, when, type Step } from "@/modules/m11-demo/data"
import { JudgeQr } from "@/modules/m11-demo/JudgeQr"
import { ResetButton } from "@/modules/m11-demo/ResetButton"
import { CUES, DEVICES, type Device } from "@/modules/m11-demo/script"
import { CutoffLadder } from "@/modules/m18-changes"
import { useChanges } from "@/modules/m18-changes/api"

const DEVICE_ICONS: Record<Device, LucideIcon> = { projector: Laptop, phone: Smartphone, ipad: Tablet }

function Stepper({ steps, current }: { steps: Step[]; current: number }) {
  return (
    <ol className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-6" aria-label="Story steps">
      {steps.map((s) => (
        <li
          key={s.n}
          aria-current={s.n === current ? "step" : undefined}
          className={cn(
            "flex flex-col gap-0.5 rounded-lg border bg-card px-2.5 py-2 text-xs",
            s.n === current && "border-blue bg-ice ring-2 ring-blue/30",
            s.n < current && "opacity-75",
          )}
        >
          <span className="flex items-center gap-1 font-semibold tabular">
            {s.done ? <CheckCircle2 className="size-3.5 text-safe" aria-label="done" /> : <span className="text-muted-foreground">{s.n}</span>}
            Act {s.act}
          </span>
          <span className={cn("line-clamp-2 leading-snug", s.n === current && "font-medium")}>{t(s.title, "en")}</span>
          <span className="text-[11px] text-muted-foreground tabular">{when(s).replace(/^\d+ \w+, /, "")}</span>
        </li>
      ))}
    </ol>
  )
}

function Block({ icon: Icon, title, children, className }: { icon: LucideIcon; title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <h3 className="flex items-center gap-1.5 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
        <Icon className="size-3.5" aria-hidden="true" /> {title}
      </h3>
      {children}
    </div>
  )
}

export function DemoPage() {
  const queryClient = useQueryClient()
  const [lang, setLang] = useState<Lang>("en")
  const [did, setDid] = useState<string[]>([])
  const scenario = useScenario()
  const priya = usePriya()
  const changes = useChanges()
  const run = useMutation({
    mutationFn: (body: { n: number; auto: boolean }) => api.post<{ current: number; did: string[] }>("/demo/step", body),
    onSuccess: (res) => {
      setDid(res.did)
      queryClient.invalidateQueries()
    },
    onError: (e) => toast.error(`Step failed: ${e.message}`),
  })

  if (scenario.isError) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-8">
        <EmptyState
          title="Couldn't load the story"
          body={scenario.error.message}
          action={
            <Button variant="outline" onClick={() => scenario.refetch()}>
              <RefreshCw /> Retry
            </Button>
          }
        />
      </div>
    )
  }
  if (!scenario.data) return <div className="mx-auto h-96 max-w-6xl animate-pulse rounded-xl bg-ice" aria-busy="true" />

  const { steps, current } = scenario.data
  const step = steps[current]
  const cue = CUES[step.n]
  const last = steps.length - 1
  const go = (n: number, auto = false) => run.mutate({ n, auto })
  const DeviceIcon = cue ? DEVICE_ICONS[cue.device] : Laptop
  const notStarted = current === 0 && !step.done

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-5 px-6 py-6">
      <PageHeader
        eyebrow="JL740 · the 4-minute story"
        title="Demo control"
        actions={
          <>
            <BrandToggle />
            <LangSwitch value={lang} onChange={setLang} />
            <ResetButton onDone={() => setDid([])} />
          </>
        }
      />
      <Stepper steps={steps} current={current} />
      <section className="rounded-xl border bg-card p-4" aria-label="When the airline listens">
        <CutoffLadder events={changes.data?.live ? changes.data.data.events : undefined} compact={current > 0} />
      </section>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,0.8fr)]">
        <section className="flex flex-col gap-5 rounded-xl border bg-card p-6" aria-live="polite" aria-labelledby="cue-title">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-sm text-muted-foreground tabular">
                Step {step.n} of {last} · Act {step.act} · {when(step)}
              </div>
              <h2 id="cue-title" className="font-display text-2xl font-bold tracking-tight">
                {t(step.title, lang)}
              </h2>
            </div>
            {cue && (
              <div className="flex items-center gap-2 rounded-lg border bg-ice/60 px-3 py-2">
                <DeviceIcon className="size-5 text-blue" aria-hidden="true" />
                <span className="text-sm">
                  <span className="block font-semibold">{DEVICES[cue.device]}</span>
                  <span className="code text-xs text-muted-foreground">{cue.screen}</span>
                </span>
                {cue.screen !== "/demo" && (
                  <Button size="sm" variant="outline" asChild>
                    <Link to={cue.screen} target="_blank" rel="noopener">
                      <ExternalLink /> Open
                    </Link>
                  </Button>
                )}
              </div>
            )}
          </div>

          {cue ? (
            <div className="grid gap-5 md:grid-cols-2">
              <Block icon={DeviceIcon} title="Do" className="md:col-span-2">
                <ol className="flex flex-col gap-1.5">
                  {cue.steps.map((line, i) => (
                    <li key={line} className="flex gap-2.5 text-base">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-blue text-xs font-semibold text-primary-foreground tabular">{i + 1}</span>
                      <span>{line}</span>
                    </li>
                  ))}
                </ol>
              </Block>
              <details className="group md:col-span-2">
                <summary className="flex cursor-pointer list-none items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase hover:text-foreground [&::-webkit-details-marker]:hidden">
                  <ChevronRight className="size-4 transition-transform duration-150 group-open:rotate-90" aria-hidden="true" /> Script
                </summary>
                <div className="mt-3 grid gap-5 md:grid-cols-2">
                  <Block icon={MessageSquareQuote} title="Say">
                    <p className="border-l-2 border-blue pl-3 text-[15px] leading-relaxed italic">“{cue.say}”</p>
                  </Block>
                  <Block icon={Eye} title="The room sees">
                    <p className="text-[15px] leading-relaxed">{cue.sees}</p>
                  </Block>
                </div>
              </details>
            </div>
          ) : (
            <p className="text-lg leading-relaxed" lang={lang}>
              {t(step.cue, lang)}
            </p>
          )}

          {did.length > 0 && (
            <ul className="flex flex-col gap-1 rounded-lg bg-mist p-3 text-sm">
              {did.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          )}
          <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t pt-4">
            <Button variant="outline" disabled={current === 0 || run.isPending} onClick={() => go(current - 1)}>
              <ArrowLeft /> Back
            </Button>
            <div className="flex flex-wrap gap-2">
              {step.auto && !notStarted && (
                <Button variant="secondary" disabled={run.isPending} onClick={() => go(step.n, true)}>
                  <Wand2 /> Do it for me: {step.auto}
                </Button>
              )}
              {notStarted ? (
                <Button size="lg" disabled={run.isPending} onClick={() => go(0)}>
                  <RotateCcw /> Start: reset to 23 Oct 18:00
                </Button>
              ) : (
                <Button size="lg" disabled={current === last || run.isPending} onClick={() => go(current + 1)}>
                  Next: {t(steps[Math.min(current + 1, last)].title, "en")} <ArrowRight />
                </Button>
              )}
            </div>
          </div>
        </section>
        <div className="flex flex-col gap-5">
          <section className="rounded-xl border bg-card p-4" aria-labelledby="priya-title">
            <h2 id="priya-title" className="mb-3 text-sm font-semibold">
              Priya's meal · 23C
            </h2>
            {priya.data?.promise ? (
              <PromiseSteps checkpoints={priya.data.promise.checkpoints} orientation="column" current={cue?.handoff && cue.handoff !== "LATE" ? cue.handoff : null} />
            ) : (
              <p className="rounded-lg bg-mist px-3 py-2 text-sm text-muted-foreground">Starts in Act 1</p>
            )}
          </section>
          <JudgeQr />
        </div>
      </div>
    </div>
  )
}
