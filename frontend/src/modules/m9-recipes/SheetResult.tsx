// One checked sheet: a verdict per diet with the rule that fired, the sheet with those words
// marked, the ingredient table, and Approve.
import { CheckCircle2 } from "lucide-react"
import { useState } from "react"

import { t } from "@/lib/i18n"
import { loadRules } from "@/lib/rules"
import type { Lang } from "@/lib/types"
import { cn } from "@/lib/utils"
import {
  Button,
  Input,
  StatusChip,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  VerdictBadge,
} from "@/ui"

import { useApprove } from "./data"
import { ENGINE, s } from "./i18n"
import type { RecipeSheet } from "./types"

const JA = /[　-鿿＀-￯]/

/** Words to mark in the sheet: the Japanese word each fired rule starts from, every ingredient
 * that carries a tag on that rule's chain (鰹節 as well as 出汁), and anything unread. */
function marks(sheet: RecipeSheet): Map<string, "unsafe" | "warn"> {
  const out = new Map<string, "unsafe" | "warn">()
  const put = (word: string, tone: "unsafe" | "warn") => {
    if (JA.test(word) && out.get(word) !== "unsafe") out.set(word, tone)
  }
  for (const v of sheet.verdicts) {
    for (const f of v.fired) {
      const tone = f.effect === "UNSAFE" ? "unsafe" : "warn"
      if (f.rule_id === "unknown_tag") {
        put(f.tag, tone)
        continue
      }
      const chain = f.via.split(" → ")
      put(chain[0], tone)
      for (const row of sheet.ingredients) {
        if (row.tags.some((tag) => chain.includes(tag))) put(row.name_ja, tone)
      }
    }
  }
  return out
}

function Marked({ text, words }: { text: string; words: Map<string, "unsafe" | "warn"> }) {
  if (words.size === 0) return <>{text}</>
  const escaped = [...words.keys()].sort((a, b) => b.length - a.length).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
  const parts = text.split(new RegExp(`(${escaped.join("|")})`, "g"))
  return (
    <>
      {parts.map((part, i) => {
        const tone = words.get(part)
        if (!tone) return part
        return (
          <mark key={i} className={cn("rounded-[3px] px-0.5 font-semibold", tone === "unsafe" ? "bg-unsafe-bg text-unsafe" : "bg-warn-bg text-warn")}>
            {part}
          </mark>
        )
      })}
    </>
  )
}

export function SheetResult({ sheet, photo, lang }: { sheet: RecipeSheet; photo?: string; lang: Lang }) {
  const diets = loadRules().diets
  const words = marks(sheet)
  const offline = sheet.engine === "dictionary"

  return (
    <article className="flex flex-col gap-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-semibold tracking-tight text-navy">
            <span lang="ja">{sheet.name.ja}</span>
            {sheet.name.ja && sheet.name.en && <span className="ml-3 text-lg font-medium text-grey">{sheet.name.en}</span>}
          </h2>
          <div className="mt-2 flex flex-wrap gap-2">
            <StatusChip status={offline ? "warn" : "info"} size="sm" label={offline ? t(s.modelOffline, lang) : t(ENGINE[sheet.engine], lang)} />
            {sheet.cached && <StatusChip status="neutral" size="sm" label={t(s.cached, lang)} />}
            <span className="code self-center text-xs text-grey" title={sheet.source_hash}>
              sha256 {sheet.source_hash.slice(0, 12)}
            </span>
          </div>
        </div>
        <ApproveBox sheet={sheet} lang={lang} />
      </header>

      <section aria-labelledby="verdicts">
        <h3 id="verdicts" className="mb-2 text-sm font-medium text-grey">
          {t(s.verdicts, lang)}
        </h3>
        <ul className="grid grid-cols-5 gap-2">
          {sheet.verdicts.map((v) => (
            <li key={v.diet} className="flex min-w-0 flex-col gap-2 rounded-[10px] border border-line bg-card p-3">
              <span className="text-sm font-semibold text-navy">{t(diets.get(v.diet)?.labels ?? { en: v.diet }, lang)}</span>
              <VerdictBadge verdict={v.verdict} fired={v.fired} lang={lang} size="sm" />
              {v.fired[0] && (
                <span className="code text-xs leading-snug break-words text-grey" title={v.fired.map((f) => f.via).join("\n")}>
                  {v.fired[0].via}
                  {v.fired.length > 1 && ` +${v.fired.length - 1}`}
                </span>
              )}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-grey">{t(s.rulesNote, lang)}</p>
        {sheet.model_note && <p className="mt-1 text-xs text-warn">{sheet.model_note}</p>}
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,4fr)_minmax(0,8fr)]">
        <section aria-labelledby="sheet" className="min-w-0 rounded-[10px] border border-line bg-card p-4">
          <h3 id="sheet" className="mb-3 text-sm font-medium text-grey">
            {t(s.sheet, lang)}
          </h3>
          {photo ? (
            <Tabs defaultValue="photo">
              <TabsList>
                <TabsTrigger value="photo">{t(s.photo, lang)}</TabsTrigger>
                <TabsTrigger value="text">{t(s.asRead, lang)}</TabsTrigger>
              </TabsList>
              <TabsContent value="photo">
                <img src={photo} alt={sheet.name.en} className="w-full rounded-md border border-line" />
              </TabsContent>
              <TabsContent value="text">
                <SheetText sheet={sheet} words={words} />
              </TabsContent>
            </Tabs>
          ) : (
            <SheetText sheet={sheet} words={words} />
          )}
        </section>

        <section aria-labelledby="ingredients" className="min-w-0 rounded-[10px] border border-line bg-card p-4">
          <h3 id="ingredients" className="mb-3 text-sm font-medium text-grey">
            {t(s.ingredients, lang)} · {sheet.ingredients.length}
          </h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t(s.colJa, lang)}</TableHead>
                <TableHead>{t(s.colEn, lang)}</TableHead>
                <TableHead>{t(s.colTags, lang)}</TableHead>
                <TableHead className="text-right">{t(s.colConf, lang)}</TableHead>
                <TableHead>{t(s.colEvidence, lang)}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sheet.ingredients.map((row, i) => (
                <TableRow key={`${row.name_ja}-${i}`}>
                  <TableCell lang="ja" className="font-medium whitespace-nowrap">
                    <Marked text={row.name_ja} words={words} />
                  </TableCell>
                  <TableCell className="whitespace-normal text-grey">{row.name_en || "–"}</TableCell>
                  <TableCell>
                    {row.tags.length ? (
                      <span className="code text-xs whitespace-normal">{row.tags.join(", ")}</span>
                    ) : (
                      <StatusChip status="warn" size="sm" className="h-auto py-0.5 whitespace-normal" label={t(s.unread, lang)} />
                    )}
                  </TableCell>
                  <TableCell className="text-right">{Math.round(row.confidence * 100)}%</TableCell>
                  <TableCell lang="ja" className="max-w-40 text-xs whitespace-normal text-grey" title={row.evidence}>
                    <Marked text={row.evidence} words={words} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      </div>
    </article>
  )
}

function SheetText({ sheet, words }: { sheet: RecipeSheet; words: Map<string, "unsafe" | "warn"> }) {
  return (
    <pre lang="ja" className="max-h-[520px] overflow-auto font-sans text-sm leading-7 whitespace-pre-wrap text-navy">
      <Marked text={sheet.text ?? ""} words={words} />
    </pre>
  )
}

function ApproveBox({ sheet, lang }: { sheet: RecipeSheet; lang: Lang }) {
  const [by, setBy] = useState("Kitchen QA")
  const approve = useApprove()
  if (sheet.status === "approved") {
    return (
      <div className="flex max-w-sm flex-col items-end gap-1 text-right">
        <StatusChip status="safe" icon={CheckCircle2} label={`${t(s.approved, lang)} · ${sheet.approved_by ?? ""}`} />
        <span className="text-xs text-grey">{t(s.specMade, lang).replace("{id}", sheet.spec_id ?? "")}</span>
      </div>
    )
  }
  return (
    <form
      className="flex items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        if (by.trim()) approve.mutate({ id: sheet.id, by: by.trim() })
      }}
    >
      <label className="flex flex-col gap-1 text-xs text-grey">
        {t(s.approvedBy, lang)}
        <Input value={by} onChange={(e) => setBy(e.target.value)} className="h-9 w-40" maxLength={60} />
      </label>
      <Button type="submit" disabled={approve.isPending || !by.trim()}>
        {approve.isPending ? t(s.approving, lang) : t(s.approve, lang)}
      </Button>
      {approve.isError && <span className="text-xs text-unsafe">{approve.error.message}</span>}
    </form>
  )
}
