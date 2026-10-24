// /demo: the presenter's control panel. Steps the sim clock through the story, says what to click next,
// and can do any step itself if a live click fails.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, ArrowRight, CheckCircle2, ExternalLink, RefreshCw, RotateCcw, Wand2 } from "lucide-react"
import { useState } from "react"
import { Link } from "react-router"

import { api } from "@/lib/api"
import { fmtTime } from "@/lib/format"
import { t } from "@/lib/i18n"
import type { Lang, Text } from "@/lib/types"
import { cn } from "@/lib/utils"
import { Button, EmptyState, LangSwitch, PageHeader, toast } from "@/ui"
import { JudgeQr } from "@/modules/m11-demo/JudgeQr"
import { ResetButton } from "@/modules/m11-demo/ResetButton"

interface Step {
  n: number
  act: number
  title: Text
  sim_time: string
  screen: string
  cue: Text
  auto: string | null
  done: boolean
}

interface Scenario {
  current: number
  steps: Step[]
}

const SCENARIO_KEY = ["m11", "scenario"]

function when(step: Step): string {
  return step.sim_time.endsWith("+09:00") ? fmtTime(step.sim_time, "JST", { date: true }) : fmtTime(step.sim_time, "IST", { date: true })
}

function StepList({ steps, current }: { steps: Step[]; current: number }) {
  return (
    <ol className="flex flex-col gap-1" aria-label="Story steps">
      {steps.map((s) => (
        <li
          key={s.n}
          aria-current={s.n === current ? "step" : undefined}
          className={cn("flex items-start gap-3 rounded-md px-3 py-2 text-sm", s.n === current && "bg-ice")}
        >
          <span className="w-5 shrink-0 pt-0.5 text-muted-foreground tabular">{s.n}</span>
          <span className="min-w-0 flex-1">
            <span className={cn("block", s.n === current && "font-semibold")}>{t(s.title, "en")}</span>
            <span className="block text-xs text-muted-foreground tabular">
              Act {s.act} · {when(s)} · {s.screen}
            </span>
          </span>
          {s.done && <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-safe" aria-label="done" />}
        </li>
      ))}
    </ol>
  )
}

export function DemoPage() {
  const queryClient = useQueryClient()
  const [lang, setLang] = useState<Lang>("en")
  const [did, setDid] = useState<string[]>([])
  const scenario = useQuery({ queryKey: SCENARIO_KEY, queryFn: () => api.get<Scenario>("/demo/scenario") })
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
  const last = steps.length - 1
  const go = (n: number, auto = false) => run.mutate({ n, auto })

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
      <PageHeader
        eyebrow="JL740 · the 4-minute story"
        title="Demo control"
        subtitle="Step the sim clock through the story. Each step says what to click; “Do it for me” covers a failed click."
        actions={
          <>
            <LangSwitch value={lang} onChange={setLang} />
            <ResetButton onDone={() => setDid([])} />
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.4fr)_minmax(0,0.8fr)]">
        <section className="rounded-xl border bg-card p-3">
          <StepList steps={steps} current={current} />
        </section>
        <section className="flex flex-col gap-5 rounded-xl border bg-card p-6" aria-live="polite" aria-labelledby="cue-title">
          <div className="text-sm text-muted-foreground tabular">
            Step {step.n} of {last} · Act {step.act} · {when(step)}
          </div>
          <h2 id="cue-title" className="font-display text-2xl font-bold tracking-tight">
            {t(step.title, lang)}
          </h2>
          <p className="text-lg leading-relaxed" lang={lang}>
            <span className="font-semibold">Now: </span>
            {t(step.cue, lang)}
          </p>
          <div className="flex flex-wrap gap-2">
            {step.screen !== "/demo" && (
              <Button variant="outline" asChild>
                <Link to={step.screen} target="_blank" rel="noopener">
                  <ExternalLink /> Open {step.screen}
                </Link>
              </Button>
            )}
            {step.auto && (
              <Button variant="secondary" disabled={run.isPending} onClick={() => go(step.n, true)}>
                <Wand2 /> Do it for me: {step.auto}
              </Button>
            )}
          </div>
          {did.length > 0 && (
            <ul className="flex flex-col gap-1 rounded-lg bg-mist p-3 text-sm">
              {did.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          )}
          <div className="mt-auto flex items-center justify-between gap-2 border-t pt-4">
            <Button variant="outline" disabled={current === 0 || run.isPending} onClick={() => go(current - 1)}>
              <ArrowLeft /> Back
            </Button>
            {current === 0 && !step.done ? (
              <Button disabled={run.isPending} onClick={() => go(0)}>
                <RotateCcw /> Start: reset to 23 Oct 18:00
              </Button>
            ) : (
              <Button disabled={current === last || run.isPending} onClick={() => go(current + 1)}>
                Next: {steps[Math.min(current + 1, last)].screen} <ArrowRight />
              </Button>
            )}
          </div>
        </section>
        <JudgeQr />
      </div>
    </div>
  )
}
