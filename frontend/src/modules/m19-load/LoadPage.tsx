// /ops/load: load for the cabin we'll actually have, and a reserve that never goes bad.
import { useQuery } from "@tanstack/react-query"
import { Scale } from "lucide-react"

import { api, FLIGHT_ID, POLL_MS } from "@/lib/api"
import { t } from "@/lib/i18n"
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, EmptyState, KpiTile, PageHeader } from "@/ui"

import { BentoSpares } from "./BentoSpares"
import { CoverageMatrix } from "./CoverageMatrix"
import { FamilyChart } from "./FamilyChart"
import { s } from "./i18n"
import { riskFamilies } from "./logic"
import { ReserveCard } from "./ReserveCard"
import type { LoadPlan } from "./types"

function Kpis({ plan }: { plan: LoadPlan }) {
  const risks = riskFamilies(plan.families)
  const universal = plan.universal.candidates.find((c) => c.reserve)
  return (
    <div className="grid gap-4 lg:grid-cols-4">
      <KpiTile label="Told us before the flight" value={`${plan.known}/${plan.passengers}`} hint="Passports and special meals; the rest are forecast." />
      <KpiTile
        label="Families at run-out risk"
        value={risks.length}
        hint={risks.map((f) => t(f.label)).join(", ") || "Every family has enough on board"}
        status={risks.length ? { status: "warn", label: t(s.runOut) } : { status: "safe", label: t(s.covered) }}
      />
      <KpiTile label="Reserve pouches to load" value={plan.reserve.pouch.q} delta={`${plan.reserve.loaded} on board`} hint="Newsvendor rule, retort pouch" />
      <KpiTile
        label="Diets the reserve covers"
        value={universal ? `${universal.covers}/${plan.universal.profiles.length}` : "–"}
        hint="Universal plate, checked by the rules engine"
        status={universal && universal.covers === plan.universal.profiles.length ? { status: "safe", label: "Every diet on the route" } : undefined}
      />
    </div>
  )
}

function Assumptions({ plan }: { plan: LoadPlan }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t(s.assumptionsTitle)}</CardTitle>
        <CardDescription>{t(plan.method)}</CardDescription>
      </CardHeader>
      <CardContent>
        <table className="w-full text-sm">
          <tbody>
            {plan.assumptions.map((a) => (
              <tr key={a.id} className="h-9 border-b last:border-0">
                <td className="pr-4">{t(a.label)}</td>
                <td className="pr-4 font-semibold whitespace-nowrap tabular">{a.value}</td>
                <td className="text-xs text-muted-foreground">{t(a.source)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  )
}

export function LoadPage() {
  const query = useQuery({
    queryKey: ["m19", "load", FLIGHT_ID],
    queryFn: () => api.get<LoadPlan>(`/load/${FLIGHT_ID}`),
    refetchInterval: POLL_MS * 5,
  })
  const plan = query.data
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
      <PageHeader eyebrow="JL740 · DEL → NRT · 25 Oct" title={t(s.title)} subtitle={t(s.subtitle)} />
      {query.isError ? (
        <EmptyState
          icon={Scale}
          title={t(s.loadError)}
          body={query.error.message}
          action={<Button variant="outline" onClick={() => query.refetch()}>Retry</Button>}
        />
      ) : !plan ? (
        <div className="flex flex-col gap-4" aria-busy="true">
          <div className="h-32 animate-pulse rounded-xl bg-ice" />
          <div className="h-96 animate-pulse rounded-xl bg-ice" />
        </div>
      ) : (
        <>
          <Kpis plan={plan} />
          <Card>
            <CardHeader>
              <CardTitle>{t(s.familiesTitle)}</CardTitle>
              <CardDescription>{t(s.familiesSub)}</CardDescription>
            </CardHeader>
            <CardContent>
              <FamilyChart families={plan.families} />
            </CardContent>
          </Card>
          <div className="grid items-start gap-6 lg:grid-cols-[1.15fr_1fr]">
            <ReserveCard reserve={plan.reserve} />
            <BentoSpares bento={plan.bento} />
          </div>
          <CoverageMatrix universal={plan.universal} />
          <Assumptions plan={plan} />
        </>
      )}
    </div>
  )
}
