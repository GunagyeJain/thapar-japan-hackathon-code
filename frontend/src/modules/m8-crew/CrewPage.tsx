// "/crew": the crew tablet. Download the flight package while online; everything below works in airplane mode.
// Layout: app bar (flight, connection, language) → three numbered tasks → the task's screen.
import { CloudDownload, Info, LayoutGrid, ListChecks, RefreshCw, ScanLine, UtensilsCrossed, Wifi, WifiOff, type LucideIcon } from "lucide-react"
import { useCallback, useMemo, useState, type ReactNode } from "react"

import { Brand } from "@/app/layouts/Brand"
import { FLIGHT_ID } from "@/lib/api"
import { useSimClock } from "@/lib/clock"
import { fmtTime } from "@/lib/format"
import type { StoredPackage } from "@/lib/offline/types"
import { useCrewStore, type CrewStore } from "@/lib/offline/store"
import { cn } from "@/lib/utils"
import { Button, StatusChip } from "@/ui"
import { Bi } from "@/modules/m8-crew/Bi"
import { CopilotTask } from "@/modules/m8-crew/CopilotTask"
import { serveProgress, type CopilotPackage } from "@/modules/m8-crew/copilot"
import { recordTap, type NewTap } from "@/modules/m8-crew/copilotStore"
import { CrewSeats } from "@/modules/m8-crew/CrewSeats"
import { GalleyCheck } from "@/modules/m8-crew/GalleyCheck"
import { COPILOT, COPY, type Bilingual } from "@/modules/m8-crew/i18n"
import { CrewLangProvider, CrewLangSwitch, useSay, useStoredCrewLang, type CrewLang } from "@/modules/m8-crew/lang"
import { galleyRows, isDone, lookup } from "@/modules/m8-crew/logic"
import { SeatScan } from "@/modules/m8-crew/SeatScan"

type Task = "galley" | "service" | "seats" | "copilot"

/** A copilot tap written to the tablet after the shared store last read its package. */
interface Tapped {
  base: StoredPackage | null
  next: StoredPackage
}

export function CrewPage() {
  const [crewLang, setCrewLang] = useStoredCrewLang()
  return (
    <CrewLangProvider value={crewLang}>
      <CrewScreens crewLang={crewLang} setCrewLang={setCrewLang} />
    </CrewLangProvider>
  )
}

function CrewScreens({ crewLang, setCrewLang }: { crewLang: CrewLang; setCrewLang: (lang: CrewLang) => void }) {
  const store = useCrewStore(FLIGHT_ID)
  const { now: simNow } = useSimClock()
  const [task, setTask] = useState<Task>("galley")
  const [seat, setSeat] = useState("23C")
  const [tapped, setTapped] = useState<Tapped | null>(null)
  const now = useCallback(() => (simNow ?? new Date()).toISOString(), [simNow])
  // A copilot tap updates the stored package directly; it shows until the shared store reads the package again.
  const stored = tapped && tapped.base === store.stored ? tapped.next : store.stored
  const pkg = stored?.pkg as CopilotPackage | undefined
  const { stored: base, syncNow } = store

  const goService = (s: string) => {
    setSeat(s)
    setTask("service")
  }

  const onTap = useCallback(
    async (tap: NewTap) => {
      try {
        const next = await recordTap(FLIGHT_ID, tap)
        if (next) setTapped({ base, next })
      } finally {
        await syncNow() // sends it now when online; offline it stays queued and the unsynced count goes up
      }
    },
    [base, syncNow],
  )

  return (
    <div className="flex min-h-screen flex-col">
      <AppBar store={store} simNow={simNow} crewLang={crewLang} setCrewLang={setCrewLang} />
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-5 py-5">
        {store.loading ? (
          <div className="h-64 animate-pulse rounded-xl bg-muted" aria-busy="true" />
        ) : !pkg ? (
          <Setup store={store} />
        ) : (
          <>
            <TaskNav pkg={pkg} task={task} onTask={setTask} />
            <div role="tabpanel" aria-label={task}>
              {task === "galley" && (
                <Screen how={COPY.howGalley}>
                  <GalleyCheck pkg={pkg} now={now} record={store.record} />
                </Screen>
              )}
              {task === "service" && (
                <Screen how={COPY.howService}>
                  <SeatScan pkg={pkg} seat={seat} onSeat={setSeat} now={now} record={store.record} />
                </Screen>
              )}
              {task === "seats" && (
                <Screen how={COPY.howSeats}>
                  <CrewSeats pkg={pkg} online={store.online} onSeat={goService} />
                </Screen>
              )}
              {task === "copilot" && (
                <Screen how={COPILOT.how}>
                  <CopilotTask pkg={pkg} now={now} onTap={onTap} onScan={goService} />
                </Screen>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  )
}

function AppBar({ store, simNow, crewLang, setCrewLang }: { store: CrewStore; simNow: Date | null; crewLang: CrewLang; setCrewLang: (l: CrewLang) => void }) {
  const say = useSay()
  const [busy, setBusy] = useState(false)
  const ready = store.stored
  const f = ready?.pkg.flight
  const update = async () => {
    setBusy(true)
    await store.download()
    setBusy(false)
  }
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-card">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-5 py-2.5">
        <Brand subtitle="客室乗務員 · Cabin crew" />
        <span className="hidden h-8 w-px bg-border md:block" aria-hidden="true" />
        <div className="text-sm leading-tight tabular">
          <div className="font-display font-semibold">
            {f ? `${f.flight_no} · ${f.origin} → ${f.dest}` : "JL740 · DEL → NRT"}
          </div>
          <div className="text-muted-foreground">{simNow ? `${fmtTime(simNow, "JST")} · ${fmtTime(simNow, "IST")}` : "--:--"}</div>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <StatusChip
            status={store.online ? "safe" : "warn"}
            icon={store.online ? Wifi : WifiOff}
            label={store.pending ? `${say(store.online ? COPY.online : COPY.offline)} · ${say(COPY.pending(store.pending))}` : say(store.online ? COPY.online : COPY.offline)}
          />
          {ready && (
            <Button
              variant="outline"
              className="h-9 gap-1.5 px-3 text-xs"
              disabled={!store.online || busy}
              onClick={() => void update()}
              title={say(COPY.redownload)}
            >
              <RefreshCw className={cn("size-3.5", busy && "animate-spin")} />
              {say(COPY.saved(fmtTime(ready.downloaded_at, "IST", { zone: false })))}
            </Button>
          )}
          <CrewLangSwitch value={crewLang} onChange={setCrewLang} compact />
        </div>
      </div>
      {store.error && <p className="mx-auto max-w-6xl px-5 pb-2 text-sm text-warn">{store.error}</p>}
    </header>
  )
}

/** First screen until the package is on the tablet. */
function Setup({ store }: { store: CrewStore }) {
  const say = useSay()
  const [busy, setBusy] = useState(false)
  const steps = [COPY.setup1, COPY.setup2, COPY.setup3]
  return (
    <section className="mx-auto mt-6 flex w-full max-w-2xl flex-col gap-6 rounded-xl border bg-card p-8">
      <Bi text={COPY.setupTitle} size="lg" />
      <ol className="flex flex-col gap-4">
        {steps.map((s, i) => (
          <li key={i} className="flex items-start gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary font-display font-bold tabular">{i + 1}</span>
            <Bi text={s} size="md" />
          </li>
        ))}
      </ol>
      <Button
        size="lg"
        className="h-14 text-lg"
        disabled={!store.online || busy}
        onClick={async () => {
          setBusy(true)
          await store.download()
          setBusy(false)
        }}
      >
        <CloudDownload /> {say(COPY.download)}
      </Button>
      {!store.online && <StatusChip status="warn" icon={WifiOff} label={say(COPY.offline)} />}
    </section>
  )
}

interface TaskCardInfo {
  id: Task
  n: number
  icon: LucideIcon
  title: Bilingual
  when: Bilingual
  progress: Bilingual
  done: boolean
}

function TaskNav({ pkg, task, onTask }: { pkg: CopilotPackage; task: Task; onTask: (t: Task) => void }) {
  const say = useSay()
  const cards = useMemo<TaskCardInfo[]>(() => {
    const L = lookup(pkg)
    const rows = [...galleyRows(pkg, L).values()].flat()
    const found = rows.filter(isDone).length
    const served = pkg.items.filter((i) => i.status === "served").length
    const specials = pkg.passengers.filter((p) => p.ssr_meal).length
    const judges = pkg.passengers.filter((p) => p.is_judge).length
    const serve = serveProgress(pkg)
    return [
      { id: "galley", n: 1, icon: UtensilsCrossed, title: COPY.task1, when: COPY.task1When, progress: COPY.progressGalley(found, rows.length), done: rows.length > 0 && found === rows.length },
      { id: "service", n: 2, icon: ScanLine, title: COPY.task2, when: COPY.task2When, progress: COPY.progressServed(served), done: false },
      { id: "seats", n: 3, icon: LayoutGrid, title: COPY.task3, when: COPY.task3When, progress: COPY.progressSeats(specials, judges), done: false },
      { id: "copilot", n: 4, icon: ListChecks, title: COPILOT.task, when: COPILOT.taskWhen, progress: COPILOT.progress(serve.done, serve.of), done: serve.of > 0 && serve.done === serve.of },
    ]
  }, [pkg])

  return (
    <nav role="tablist" aria-label="Tasks" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((c) => {
        const active = c.id === task
        return (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onTask(c.id)}
            className={cn(
              "flex min-h-20 items-center gap-3 rounded-xl border p-3 text-left transition-colors duration-150",
              active ? "border-blue bg-secondary ring-1 ring-blue" : "border-border bg-card hover:border-sky",
            )}
          >
            <span
              className={cn(
                "flex size-11 shrink-0 items-center justify-center rounded-lg",
                active ? "bg-blue text-primary-foreground" : "bg-muted text-muted-foreground",
              )}
            >
              <c.icon className="size-5" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[11px] font-medium tracking-wider text-muted-foreground uppercase tabular">
                {c.n} · {say(c.when)}
              </span>
              <Bi text={c.title} size="md" className="font-semibold" />
              <span className={cn("mt-0.5 block text-sm tabular", c.done ? "text-safe" : "text-muted-foreground")}>{say(c.progress)}</span>
            </span>
          </button>
        )
      })}
    </nav>
  )
}

/** A task's screen with its one-line how-to on top. */
function Screen({ how, children }: { how: Bilingual; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-4">
      <p className="flex items-start gap-2 rounded-lg bg-secondary/60 px-3 py-2 text-sm">
        <Info className="mt-0.5 size-4 shrink-0 text-sky" aria-hidden="true" />
        <Bi text={how} size="sm" />
      </p>
      {children}
    </div>
  )
}
