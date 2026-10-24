// One change event, decided: the fix in plain words, the need, every rung tried, the message the passenger got
// and what today's process would have done. Used by Change control (detail panel) and the Change desk.
import { CheckCircle2, Minus, XCircle } from "lucide-react"
import type { ReactNode } from "react"

import { fmtTime } from "@/lib/format"
import { t } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { Badge } from "@/ui"

import { KINDS, RUNGS, WINDOWS } from "./labels"
import { strictestTier } from "./metrics"
import { ChannelLabel, OutcomeChip, RungBadge, TierBadge } from "./parts"
import type { ChangeEvent } from "./types"
import { decisionHeadline, needSummary, stepsOf, type ItemPlace } from "./words"

export interface DecisionCardProps {
  event: ChangeEvent & { n?: number }
  place?: ItemPlace | null
  className?: string
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col gap-2">
      <h4 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</h4>
      {children}
    </section>
  )
}

export function DecisionCard({ event: e, place, className }: DecisionCardProps) {
  const d = e.decision
  const lang = e.request.lang
  const steps = stepsOf(d)
  const need = needSummary(e.request)
  return (
    <article className={cn("@container flex flex-col gap-4", className)} aria-label={`Change ${e.seat ?? ""} ${e.name ?? ""}`}>
      <header className="flex flex-col gap-1">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground tabular">
          {e.n !== undefined && <span className="font-semibold text-foreground">#{e.n}</span>}
          <span>{fmtTime(e.at, "IST", { date: true })}</span>
          <span aria-hidden="true">·</span>
          <ChannelLabel channel={e.channel} />
          <span aria-hidden="true">·</span>
          <span>{KINDS[e.kind]}</span>
          <span aria-hidden="true">·</span>
          <span>{WINDOWS[e.window].name} window</span>
        </p>
        <h3 className="font-display text-xl leading-tight font-semibold">
          <span className="tabular">{e.seat ?? "—"}</span> {e.name ?? "Passenger"}
        </h3>
      </header>

      <div className="flex flex-col gap-1.5 rounded-lg border bg-ice/60 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <OutcomeChip event={e} side="ours" size="md" />
          <RungBadge rung={d.rung} className="bg-card" />
        </div>
        <p className="font-display text-lg leading-snug font-semibold text-navy">{decisionHeadline(d, place)}</p>
        <p className="text-sm text-muted-foreground">{t(d.reason, "en")}</p>
        {(d.item_id || d.spec_name || d.kitchen_note) && (
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            {d.item_id && <span className="code font-semibold">{d.item_id}</span>}
            {d.code && (
              <Badge variant="secondary" className="code">
                {d.code}
              </Badge>
            )}
            {d.spec_name && <span>{t(d.spec_name, "en")}</span>}
            {d.kitchen_note && <span className="code text-xs text-navy">{d.kitchen_note}</span>}
          </p>
        )}
      </div>

      <div className="grid gap-x-6 gap-y-4 @2xl:grid-cols-2 @5xl:grid-cols-4">
        <Section title="The need">
          <span>
            <TierBadge tier={strictestTier(e.request.tiers)} />
          </span>
          <p className="text-sm">{need}</p>
          {e.request.note && <p className="text-sm text-muted-foreground">{e.request.note}</p>}
        </Section>

        <Section title="Rungs tried">
          <ol className="flex flex-col gap-1.5 text-sm">
            {steps.map((s) => {
              const Icon = !s.chosen ? Minus : d.ok ? CheckCircle2 : XCircle
              return (
                <li key={s.rung} className="grid grid-cols-[18px_1fr] gap-x-1.5">
                  <Icon className={cn("mt-0.5 size-4", !s.chosen ? "text-muted-foreground" : d.ok ? "text-safe" : "text-unsafe")} aria-hidden="true" />
                  <span>
                    <span className={cn("font-medium", !s.chosen && "text-muted-foreground")}>
                      {RUNGS[s.rung].label}
                      <span className="sr-only">{s.chosen ? " (chosen)" : " (skipped)"}</span>
                    </span>
                    {s.reason && <span className="block text-xs text-muted-foreground">{s.reason}</span>}
                  </span>
                </li>
              )
            })}
          </ol>
        </Section>

        <Section title="Message to the passenger">
          {e.message ? (
            <div className="flex flex-col gap-1.5 rounded-lg border bg-mist p-3">
              <p lang={lang} className="text-[15px] leading-snug">
                {t(e.message, lang)}
              </p>
              {lang !== "en" && <p className="border-t pt-1.5 text-xs text-muted-foreground">EN: {t(e.message, "en")}</p>}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No message: nobody to tell. The meal goes back into stock.</p>
          )}
        </Section>

        <Section title="Today's process">
          <span>
            <OutcomeChip event={e} side="today" />
          </span>
          <p className="text-sm">{t(e.today.outcome, "en")}</p>
        </Section>
      </div>
    </article>
  )
}
