// The reserve sized by the newsvendor rule: the formula written out, fresh spare vs retort pouch side by side.
import { Package, Utensils } from "lucide-react"
import type { ReactNode } from "react"

import { t } from "@/lib/i18n"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, StatusChip } from "@/ui"

import { s } from "./i18n"
import { fmtInr, fmtPct } from "./logic"
import type { Newsvendor, Reserve } from "./types"

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right tabular">{children}</span>
    </div>
  )
}

function Option({ title, icon, n, wasteNote, highlight }: { title: string; icon: ReactNode; n: Newsvendor; wasteNote: string; highlight?: boolean }) {
  return (
    <div className={highlight ? "flex flex-col gap-2 rounded-lg border border-blue bg-ice p-4" : "flex flex-col gap-2 rounded-lg border p-4"}>
      <div className="flex items-center gap-2 text-sm font-semibold">
        {icon}
        {title}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="font-display text-[48px] leading-none font-bold tracking-tight tabular">{n.q}</span>
        <span className="text-sm text-muted-foreground">to load (q*)</span>
      </div>
      <Fact label="Co, an unused one">{fmtInr(n.co)}</Fact>
      <Fact label="Cu / (Cu + Co)">{n.ratio.toFixed(4)}</Fact>
      <Fact label="Flights fully covered">{fmtPct(n.covered)}</Fact>
      <Fact label="Thrown away per flight">{n.expected_waste.toFixed(1)}</Fact>
      <Fact label="Expected cost per flight">{fmtInr(n.cost_per_flight)}</Fact>
      <p className="text-xs text-muted-foreground">{wasteNote}</p>
    </div>
  )
}

export function ReserveCard({ reserve }: { reserve: Reserve }) {
  const lambdaParts = [`${reserve.base} late hard needs a flight`, ...reserve.factors.map((f) => `${f.factor} ${t(f.label)}`)]
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t(s.reserveTitle)}</CardTitle>
        <CardDescription>
          Cu = {fmtInr(reserve.fresh.cu)}: a passenger with a strict rule going about 7 hours without a meal (the 2013 Delhi
          consumer-commission award against JAL).
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="rounded-lg bg-muted px-4 py-3 text-sm">
          <p className="font-medium">{t(reserve.formula)}</p>
          <p className="mt-1 text-muted-foreground tabular">
            Late hard needs on this flight ~ Poisson(λ), λ = {lambdaParts.join(" × ")} = {reserve.lambda.toFixed(2)}
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Option title={t(s.fresh)} icon={<Utensils className="size-4" aria-hidden="true" />} n={reserve.fresh}
            wasteNote="An unused fresh meal is thrown away after the flight." />
          <Option title={t(s.pouch)} icon={<Package className="size-4" aria-hidden="true" />} n={reserve.pouch} highlight
            wasteNote="An unused pouch stays sealed and flies again (12-month shelf life)." />
        </div>
        <p className="font-display text-lg leading-snug font-semibold text-navy">{t(reserve.point)}</p>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <StatusChip
            status={reserve.loaded >= reserve.pouch.q ? "safe" : "warn"}
            size="sm"
            label={`On board now: ${reserve.loaded} pouches`}
          />
          <span className="text-muted-foreground tabular">
            covers {fmtPct(reserve.loaded_covered)} of flights; {reserve.pouch.q} would cover {fmtPct(reserve.pouch.covered)}.
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
