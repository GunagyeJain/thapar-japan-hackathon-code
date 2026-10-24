// The matcher's answer: the tier ladder, the chosen meal (or voucher), and why every alternative failed.
// Used on /ops/late and by m3 (judge join). Props: {result, lang?, compact?}.
import { Cpu, Ticket } from "lucide-react"

import { t } from "@/lib/i18n"
import type { Lang } from "@/lib/types"
import { cn } from "@/lib/utils"
import { StatusChip, VerdictBadge } from "@/ui"
import { STR, TIER_TEXT } from "@/modules/m6-matcher/i18n"
import type { Considered, MatchResult as Result, Tier } from "@/modules/m6-matcher/types"

const LADDER: Tier[] = ["spare_special", "main_menu", "backup", "voucher"]

export interface MatchResultProps {
  result: Result
  lang?: Lang
  compact?: boolean
}

function TierLadder({ tier, lang }: { tier: Tier; lang: Lang }) {
  const reached = LADDER.indexOf(tier)
  return (
    <ol className="grid grid-cols-4 gap-1.5" aria-label="Tier ladder">
      {LADDER.map((step, i) => (
        <li
          key={step}
          aria-current={i === reached ? "step" : undefined}
          className={cn(
            "flex flex-col gap-0.5 rounded-md border px-2.5 py-2 text-xs",
            i === reached && (step === "voucher" ? "border-warn bg-warn-bg" : "border-safe bg-safe-bg"),
            i > reached && "opacity-50",
          )}
        >
          <span className="text-muted-foreground tabular">{i + 1}</span>
          <span className="font-medium">{t(TIER_TEXT[step], lang)}</span>
          {i < reached && <span className="text-muted-foreground">{t(STR.noneSafe, lang)}</span>}
        </li>
      ))}
    </ol>
  )
}

function Chosen({ result, lang }: { result: Result; lang: Lang }) {
  const item = result.item
  if (!item) return null
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-safe/40 bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <VerdictBadge verdict="SAFE" lang={lang} />
        <span className="font-display text-lg font-semibold">{t(item.spec.name, lang)}</span>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground tabular">
        <span className="code text-foreground">{item.id}</span>
        <span>
          Galley {item.galley.slice(-1)} · {item.position}
        </span>
        {item.spec.code && <span className="code">{item.spec.code}</span>}
        {result.label_mark && <span>{t(result.label_mark, lang)}</span>}
      </div>
    </div>
  )
}

function VoucherCard({ result, lang }: { result: Result; lang: Lang }) {
  const v = result.voucher
  if (!v) return null
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-warn/40 bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <StatusChip status="warn" label={t(STR.voucherTitle, lang)} icon={Ticket} />
        <span className="font-display text-lg font-semibold tabular">₹{v.value_inr}</span>
        <span className="code text-sm">{v.code}</span>
      </div>
      <ul className="text-sm text-muted-foreground">
        {v.outlets.map((o) => (
          <li key={o.name}>
            {o.name} · {o.terminal} · {o.open}
          </li>
        ))}
      </ul>
      {v.illustrative && <p className="text-xs text-muted-foreground">{t(STR.illustrative, lang)}</p>}
    </div>
  )
}

function ConsideredRow({ row, lang }: { row: Considered; lang: Lang }) {
  const reason = row.fired.length > 0 ? row.fired.map((f) => t(f.message, lang)).join(" · ") : row.note ? t(row.note, lang) : t(STR.safe, lang)
  return (
    <li className={cn("grid grid-cols-[1fr_auto] items-start gap-x-3 gap-y-1 border-t py-2.5 first:border-t-0", row.chosen && "bg-ice/40")}>
      <div className="min-w-0">
        <div className="font-medium">{t(row.spec_name, lang)}</div>
        <div className="text-sm text-muted-foreground">
          {t(TIER_TEXT[row.tier], lang)} · G{row.galley.slice(-1)} · {reason}
          {row.fired.length > 0 && row.note && ` · ${t(row.note, lang)}`}
        </div>
      </div>
      <VerdictBadge verdict={row.verdict} fired={row.fired} lang={lang} size="sm" />
    </li>
  )
}

export function MatchResult({ result, lang = "en", compact = false }: MatchResultProps) {
  const others = result.considered.filter((r) => !r.chosen)
  return (
    <section className="flex flex-col gap-4" aria-label="Match result">
      <TierLadder tier={result.tier} lang={lang} />
      {result.status === "matched" ? <Chosen result={result} lang={lang} /> : <VoucherCard result={result} lang={lang} />}
      <p className="text-sm">{t(result.explanation, lang)}</p>
      {!compact && others.length > 0 && (
        <details>
          <summary className="cursor-pointer pb-1 text-sm font-medium text-muted-foreground hover:text-foreground">
            {t(STR.considered, lang)} ({others.length})
          </summary>
          <ul>
            {others.map((row) => (
              <ConsideredRow key={`${row.item_id}-${row.tier}`} row={row} lang={lang} />
            ))}
          </ul>
        </details>
      )}
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground tabular">
        <Cpu className="size-3.5" aria-hidden="true" />
        {result.solver.engine === "cp-sat" ? "CP-SAT" : "Greedy"} · {result.solver.ms} ms · {result.solver.swaps.length} swap
        {result.solver.swaps.length === 1 ? "" : "s"} · {result.considered.length} meals checked
      </p>
    </section>
  )
}
