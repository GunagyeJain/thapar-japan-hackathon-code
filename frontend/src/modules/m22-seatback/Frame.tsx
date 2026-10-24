// The seatback display's bezel and top bar: flight, seat and initials, how far along the route, the time, the language.
import { Plane } from "lucide-react"
import type { ReactNode } from "react"

import { useSimClock } from "@/lib/clock"
import { t } from "@/lib/i18n"
import type { Lang } from "@/lib/types"
import { cn } from "@/lib/utils"
import { DualClock, LangSwitch } from "@/ui"

import { SEAT } from "./i18n"
import type { SeatView } from "./types"

/** 16:9 in a bezel on a laptop; the whole screen on a phone. */
export function Frame({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center md:p-8">
      <div
        className={cn(
          "flex min-h-screen w-full max-w-[1180px] flex-col overflow-hidden bg-card md:aspect-[16/9] md:min-h-0 md:rounded-[22px] md:border-[10px] md:border-border",
          className,
        )}
      >
        {children}
      </div>
    </div>
  )
}

export function TopBar({ view, lang, onLang }: { view: SeatView | undefined; lang: Lang; onLang: (l: Lang) => void }) {
  const f = view?.flight
  return (
    <header className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b px-5 py-3 md:px-8">
      <div className="flex items-center gap-3">
        <span className="font-display text-lg font-bold">{f ? `${f.flight_no} · ${t(SEAT.route(f.origin, f.dest), lang)}` : "JL740"}</span>
        {view && (
          <span className="rounded-md bg-secondary px-2.5 py-1 text-sm font-semibold tabular">
            {view.initials ? `${view.initials} · ` : ""}
            {t(SEAT.seat(view.seat), lang)}
          </span>
        )}
      </div>
      {f && <RouteProgress std={f.std} sta={f.sta} from={f.origin} to={f.dest} lang={lang} />}
      <div className="ml-auto flex items-center gap-4">
        <DualClock className="hidden sm:flex" />
        <LangSwitch value={lang} onChange={onLang} />
      </div>
    </header>
  )
}

function RouteProgress({ std, sta, from, to, lang }: { std: string; sta: string; from: string; to: string; lang: Lang }) {
  const { now } = useSimClock()
  const start = Date.parse(std)
  const span = Date.parse(sta) - start
  const share = now && span > 0 ? Math.min(1, Math.max(0, (now.getTime() - start) / span)) : 0
  const pct = `${Math.round(share * 100)}%`
  return (
    <div className="hidden min-w-48 flex-1 items-center gap-2 text-xs text-muted-foreground lg:flex" aria-label={t(SEAT.progress(pct), lang)}>
      <span className="code">{from}</span>
      <span className="relative h-1 flex-1 rounded-full bg-secondary">
        <span className="absolute inset-y-0 left-0 rounded-full bg-sky" style={{ width: pct }} />
        <Plane className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rotate-45 text-sky" style={{ left: pct }} aria-hidden="true" />
      </span>
      <span className="code">{to}</span>
    </div>
  )
}
