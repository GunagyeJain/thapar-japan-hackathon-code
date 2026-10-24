// The universal-plate table: 5 reserve candidates × 13 diet profiles, each cell from the rules engine.
import { AlertTriangle, CheckCircle2, XCircle, type LucideIcon } from "lucide-react"

import { t } from "@/lib/i18n"
import type { Verdict } from "@/lib/types"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle, StatusChip } from "@/ui"

import { s } from "./i18n"
import { More } from "./More"
import { cellFor, coverLabel, failReasons, splitName } from "./logic"
import type { Candidate, Universal } from "./types"

const ICONS: Record<Verdict, { icon: LucideIcon; className: string }> = {
  SAFE: { icon: CheckCircle2, className: "text-safe" },
  UNSAFE: { icon: XCircle, className: "text-unsafe" },
  NEEDS_HUMAN: { icon: AlertTriangle, className: "text-warn" },
}

function VerdictCell({ verdict, why, label }: { verdict: Verdict; why: string; label: string }) {
  const { icon: Icon, className } = ICONS[verdict]
  const cell = cellFor(verdict)
  return (
    <td className="px-1 py-2 text-center" title={`${label}: ${cell.word}${why ? ` (${why})` : ""}`}>
      <span className={cn("inline-flex flex-col items-center gap-0.5 text-[11px] leading-none font-medium", className)}>
        <Icon className="size-4" aria-hidden="true" />
        {cell.word}
      </span>
    </td>
  )
}

function CandidateRow({ c, profiles }: { c: Candidate; profiles: Universal["profiles"] }) {
  const total = profiles.length
  const [title, detail] = splitName(t(c.name))
  return (
    <tr className={cn("border-b last:border-0", c.reserve && "bg-ice")}>
      <th scope="row" className="py-2 pr-3 text-left align-middle font-normal">
        <div className={cn("text-sm", c.reserve ? "font-semibold text-navy" : "font-medium")}>{title}</div>
        {detail && <div className="text-xs">{detail}</div>}
        {c.reserve && <div className="text-xs text-muted-foreground">On board · galley 2</div>}
      </th>
      {c.matrix.map((v, i) => (
        <VerdictCell key={profiles[i].id} verdict={v} label={t(profiles[i].label)} why={failReasons(c.fired[i]).join(", ")} />
      ))}
      <td className="py-2 pl-3 text-right">
        <StatusChip
          size={c.reserve ? "md" : "sm"}
          status={c.covers === total ? "safe" : c.covers >= total - 4 ? "warn" : "unsafe"}
          label={coverLabel(c.covers, total, c.checks)}
        />
      </td>
    </tr>
  )
}

export function CoverageMatrix({ universal }: { universal: Universal }) {
  const { profiles, candidates, notes } = universal
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t(s.universalTitle)}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] border-collapse text-sm">
            <thead>
              <tr className="border-b align-bottom text-muted-foreground">
                <th scope="col" className="w-52 py-2 pr-3 text-left text-xs font-medium">Reserve candidate</th>
                {profiles.map((p) => (
                  <th key={p.id} scope="col" className="px-1 py-2 text-center text-[11px] leading-tight font-medium">
                    {t(p.label)}
                  </th>
                ))}
                <th scope="col" className="py-2 pl-3 text-right text-xs font-medium">Covers</th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((c) => (
                <CandidateRow key={c.id} c={c} profiles={profiles} />
              ))}
            </tbody>
          </table>
        </div>
        {notes.length > 0 && (
          <More title="Notes">
            <ul className="flex flex-col gap-1 text-muted-foreground">
              {notes.map((n) => (
                <li key={n.en}>{t(n)}</li>
              ))}
            </ul>
          </More>
        )}
      </CardContent>
    </Card>
  )
}
