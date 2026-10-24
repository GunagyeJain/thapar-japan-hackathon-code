// The Accuracy tab: dictionary vs extraction model vs both, on hand-labelled Japanese recipe sheets.
import { RefreshCw } from "lucide-react"

import { t } from "@/lib/i18n"
import type { Lang } from "@/lib/types"
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, DataTable, StatusChip, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, type Column } from "@/ui"

import { useEvalTable } from "./data"
import { FAMILY, READER, s } from "./i18n"
import type { EvalMetrics, EvalReader, EvalRow } from "./types"

const READERS: EvalReader[] = ["dictionary", "model", "combined"]

const fill = (text: string, vars: Record<string, string | number>) => text.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ""))
const pct = (x: number | null) => (x === null ? "–" : `${Math.round(x * 100)}%`)
const family = (f: string, lang: Lang) => (FAMILY[f] ? t(FAMILY[f], lang) : f)

export function EvalPanel({ lang }: { lang: Lang }) {
  const q = useEvalTable()

  if (q.isError) {
    return (
      <Button variant="outline" size="sm" className="w-fit" onClick={() => q.refetch()}>
        <RefreshCw /> {t(s.evalRetry, lang)}: {q.error.message}
      </Button>
    )
  }

  const rows = q.data?.rows ?? []
  const columns: Column<EvalRow>[] = [
    {
      key: "dish",
      header: t(s.evalDish, lang),
      sortValue: (r) => r.dish.en,
      cell: (r) => (
        <span className="flex flex-col">
          <span lang="ja" className="font-medium text-navy">{r.dish.ja}</span>
          <span className="text-xs text-grey">{r.dish.en}</span>
        </span>
      ),
    },
    {
      key: "truth",
      header: t(s.evalTruth, lang),
      cell: (r) =>
        r.truth.length ? (
          <span className="flex flex-wrap gap-1">
            {r.truth.map((f) => (
              <Badge key={f} variant="secondary">{family(f, lang)}</Badge>
            ))}
          </span>
        ) : (
          <span className="text-grey">{t(s.evalNone, lang)}</span>
        ),
    },
    ...READERS.map((k) => ({
      key: k,
      header: t(READER[k], lang),
      sortValue: (r: EvalRow) => score(r, k),
      cell: (r: EvalRow) => <ReaderCell truth={r.truth} found={r[k]} lang={lang} />,
    })),
  ]

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-navy">{t(s.evalTitle, lang)}</CardTitle>
          <p className="text-sm text-grey">{fill(t(s.evalIntro, lang), { n: rows.length || "–" })}</p>
          {q.data && q.data.compared < rows.length && (
            <p className="text-sm text-grey">{fill(t(s.evalCompared, lang), { m: q.data.compared, n: rows.length })}</p>
          )}
        </CardHeader>
        <CardContent>
          {q.isPending ? <div className="h-36 animate-pulse rounded-md bg-ice" /> : <Summary metrics={q.data.metrics} lang={lang} />}
        </CardContent>
      </Card>

      <DataTable rows={rows} columns={columns} rowKey={(r) => r.id} isLoading={q.isPending} />
    </div>
  )
}

function Summary({ metrics, lang }: { metrics: Record<EvalReader, EvalMetrics | null>; lang: Lang }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t(s.evalReader, lang)}</TableHead>
          <TableHead className="text-right">{t(s.evalFound, lang)}</TableHead>
          <TableHead className="text-right">{t(s.evalMissed, lang)}</TableHead>
          <TableHead className="text-right">{t(s.evalFalse, lang)}</TableHead>
          <TableHead className="text-right">{t(s.evalCaught, lang)}</TableHead>
          <TableHead className="text-right">{t(s.evalFlagged, lang)}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {READERS.map((k) => {
          const m = metrics[k]
          const of = (a: number, b: number) => fill(t(s.evalOf, lang), { a, b })
          return (
            <TableRow key={k}>
              <TableCell className="font-medium text-navy">{t(READER[k], lang)}</TableCell>
              {m ? (
                <>
                  <TableCell className="text-right tabular">
                    <span className="font-display text-lg font-semibold text-navy">{pct(m.recall)}</span>{" "}
                    <span className="text-xs text-grey">{of(m.hits, m.hits + m.misses)}</span>
                  </TableCell>
                  <TableCell className="text-right tabular">{m.misses}</TableCell>
                  <TableCell className="text-right tabular">{m.false_alarms}</TableCell>
                  <TableCell className="text-right tabular">{of(m.unsafe_dishes_caught, m.unsafe_dishes)}</TableCell>
                  <TableCell className="text-right tabular">{of(m.safe_dishes_flagged, m.safe_dishes)}</TableCell>
                </>
              ) : (
                <TableCell colSpan={5} className="text-right text-grey">{t(s.evalNotRun, lang)}</TableCell>
              )}
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}

function ReaderCell({ truth, found, lang }: { truth: string[]; found: string[] | null; lang: Lang }) {
  if (found === null) return <span className="text-grey">{t(s.evalNotRun, lang)}</span>
  const missed = truth.filter((f) => !found.includes(f))
  const extra = found.filter((f) => !truth.includes(f))
  const hits = found.filter((f) => truth.includes(f))
  if (!hits.length && !missed.length && !extra.length) return <span className="text-grey">{t(s.evalNone, lang)}</span>
  return (
    <span className="flex flex-wrap gap-1">
      {hits.map((f) => (
        <StatusChip key={f} size="sm" status="safe" label={family(f, lang)} />
      ))}
      {missed.map((f) => (
        <StatusChip key={f} size="sm" status="unsafe" label={fill(t(s.evalMissedChip, lang), { f: family(f, lang) })} />
      ))}
      {extra.map((f) => (
        <StatusChip key={f} size="sm" status="warn" label={fill(t(s.evalFalseChip, lang), { f: family(f, lang) })} />
      ))}
    </span>
  )
}

/** Sort key: rows with misses first, then false alarms. */
function score(r: EvalRow, k: EvalReader): number {
  const found = r[k]
  if (found === null) return -1
  return 10 * r.truth.filter((f) => !found.includes(f)).length + found.filter((f) => !r.truth.includes(f)).length
}
