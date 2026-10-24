// /ops/load: load for the cabin we'll actually have, and a reserve that never goes bad.
import { useQuery } from "@tanstack/react-query"
import { Scale } from "lucide-react"

import { api, FLIGHT_ID, POLL_MS } from "@/lib/api"
import { t } from "@/lib/i18n"
import { Button, Card, CardContent, CardHeader, CardTitle, EmptyState, KpiTile, PageHeader } from "@/ui"

import { BentoSpares } from "./BentoSpares"
import { CoverageMatrix } from "./CoverageMatrix"
import { FamilyChart } from "./FamilyChart"
import { s } from "./i18n"
import { riskFamilies } from "./logic"
import { More } from "./More"
import { ReserveCard } from "./ReserveCard"
import type { LoadPlan } from "./types"

function Kpis({ plan }: { plan: LoadPlan }) {
  const risks = riskFamilies(plan.families)
  const universal = plan.universal.candidates.find((c) => c.reserve)
  return (
    <div className="grid gap-4 lg:grid-cols-4">
      <KpiTile label="Told us before the flight" value={`${plan.known}/${plan.passengers}`} />
      <KpiTile
        label="Families at run-out risk"
        value={risks.length}
        status={risks.length ? { status: "warn", label: t(s.runOut) } : { status: "safe", label: t(s.covered) }}
      />
      <KpiTile label="Reserve pouches to load" value={plan.reserve.pouch.q} delta={`${plan.reserve.loaded} on board`} />
      <KpiTile
        label="Diets the reserve covers"
        value={universal ? `${universal.covers}/${plan.universal.profiles.length}` : "–"}
        status={universal && universal.covers === plan.universal.profiles.length ? { status: "safe", label: "Every diet" } : undefined}
      />
    </div>
  )
}

function Assumptions({ plan }: { plan: LoadPlan }) {
  return (
    <More title={t(s.assumptionsTitle)}>
      <p className="text-muted-foreground">{t(plan.method)}</p>
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
    </More>
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
