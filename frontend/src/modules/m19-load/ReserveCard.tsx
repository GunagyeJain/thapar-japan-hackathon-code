// The reserve sized by the newsvendor rule: the formula written out, fresh spare vs retort pouch side by side.
import { Package, Utensils } from "lucide-react"
import type { ReactNode } from "react"

import { t } from "@/lib/i18n"
import { Card, CardContent, CardHeader, CardTitle, StatusChip } from "@/ui"

import { s } from "./i18n"
import { fmtInr, fmtPct } from "./logic"
import { More } from "./More"
import type { Newsvendor, Reserve } from "./types"

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right tabular">{children}</span>
    </div>
  )
}

function Option({ title, icon, n, highlight }: { title: string; icon: ReactNode; n: Newsvendor; highlight?: boolean }) {
  return (
    <div className={highlight ? "flex flex-col gap-2 rounded-lg border border-blue bg-ice p-4" : "flex flex-col gap-2 rounded-lg border p-4"}>
      <div className="flex items-center gap-2 text-sm font-semibold">
        {icon}
        {title}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="font-display text-[48px] leading-none font-bold tracking-tight tabular">{n.q}</span>
        <span className="text-sm text-muted-foreground">to load</span>
      </div>
      <Fact label="Flights covered">{fmtPct(n.covered)}</Fact>
      <Fact label="Thrown away">{n.expected_waste.toFixed(1)}</Fact>
      <Fact label="Cost per flight">{fmtInr(n.cost_per_flight)}</Fact>
    </div>
  )
}

export function ReserveCard({ reserve }: { reserve: Reserve }) {
  const lambdaParts = [`${reserve.base} late hard needs a flight`, ...reserve.factors.map((f) => `${f.factor} ${t(f.label)}`)]
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t(s.reserveTitle)}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Option title={t(s.fresh)} icon={<Utensils className="size-4" aria-hidden="true" />} n={reserve.fresh} />
          <Option title={t(s.pouch)} icon={<Package className="size-4" aria-hidden="true" />} n={reserve.pouch} highlight />
        </div>
        <p className="font-display text-lg leading-snug font-semibold text-navy">{t(reserve.point)}</p>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <StatusChip
            status={reserve.loaded >= reserve.pouch.q ? "safe" : "warn"}
            size="sm"
            label={`On board now: ${reserve.loaded} pouches`}
          />
          <span className="text-muted-foreground tabular">covers {fmtPct(reserve.loaded_covered)} of flights</span>
        </div>
        <More title={t(s.howSized)}>
          <p className="text-muted-foreground">
            Cu = {fmtInr(reserve.fresh.cu)}: a strict-rule passenger left without a meal (the 2013 Delhi consumer-commission
            award against JAL). Co = {fmtInr(reserve.fresh.co)} for an unused fresh meal, {fmtInr(reserve.pouch.co)} for a pouch that flies again.
          </p>
          <p className="font-medium">{t(reserve.formula)}</p>
          <p className="text-muted-foreground tabular">
            Late hard needs ~ Poisson(λ), λ = {lambdaParts.join(" × ")} = {reserve.lambda.toFixed(2)}. Critical ratio: fresh{" "}
            {reserve.fresh.ratio.toFixed(4)}, pouch {reserve.pouch.ratio.toFixed(4)}.
          </p>
        </More>
      </CardContent>
    </Card>
  )
}
