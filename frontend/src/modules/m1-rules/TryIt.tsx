// "Try it": pick diets and a dish from tonight's load, see the verdict and the rule that fired.
// The browser engine answers instantly; the server answers too, and we show that they agree.
import { useQuery } from "@tanstack/react-query"
import { CircleCheck, CircleX, Plus, X } from "lucide-react"
import { useState, type FormEvent } from "react"

import specsJson from "@shared/seed/meal_specs.json"
import { api } from "@/lib/api"
import { t } from "@/lib/i18n"
import { combinePresets, evaluate, label, loadRules, specTags, type Evaluation, type Fired } from "@/lib/rules"
import type { Lang, MealSpec } from "@/lib/types"
import { cn } from "@/lib/utils"
import { Button } from "@/ui/button"
import { Checkbox } from "@/ui/checkbox"
import { Input } from "@/ui/input"
import { VerdictBadge } from "@/ui/VerdictBadge"
import { STR } from "@/modules/m1-rules/i18n"

const SPECS = specsJson as MealSpec[]
const DEFAULT_SPEC = "SPEC-Y-PANEER"

interface TryItProps {
  lang: Lang
}

function sameAnswer(a: Evaluation, b: Evaluation): boolean {
  const key = (e: Evaluation) => JSON.stringify([e.verdict, e.fired.map((f) => [f.rule_id, f.via])])
  return key(a) === key(b)
}

function FiredRow({ fired, lang }: { fired: Fired; lang: Lang }) {
  return (
    <li className="flex flex-col gap-1 border-t py-3 first:border-t-0">
      <div className="flex flex-wrap items-center gap-2">
        <VerdictBadge verdict={fired.effect} lang={lang} size="sm" />
        <span className="font-medium text-navy">{t(fired.message, lang)}</span>
      </div>
      <div className="font-mono text-xs text-grey">
        {fired.via} · {fired.rule_id}
      </div>
    </li>
  )
}

function ServerAgreement({ local, server }: { local: Evaluation; server: ReturnType<typeof useServerVerdict> }) {
  if (server.isPending) return <p className="text-sm text-grey">Asking the server…</p>
  if (server.isError) {
    return (
      <p className="flex items-center gap-2 text-sm text-warn">
        Server unreachable: the offline engine still answers. {server.error.message}
        <Button variant="outline" size="sm" onClick={() => server.refetch()}>
          Retry
        </Button>
      </p>
    )
  }
  const agree = sameAnswer(local, server.data)
  const Icon = agree ? CircleCheck : CircleX
  return (
    <p className={cn("flex items-center gap-2 text-sm", agree ? "text-safe" : "text-unsafe")}>
      <Icon className="size-4" aria-hidden="true" />
      {agree ? "Server and offline tablet give the same answer" : "Server and offline tablet disagree"}
    </p>
  )
}

function useServerVerdict(forbid: string[], tags: string[]) {
  return useQuery({
    queryKey: ["m1", "evaluate", forbid, tags],
    queryFn: () => api.post<Evaluation>("/rules/evaluate", { forbid, spec_tags: tags }),
    enabled: forbid.length > 0,
  })
}

export function TryIt({ lang }: TryItProps) {
  const rules = loadRules()
  const [presets, setPresets] = useState<string[]>(["jain"])
  const [specId, setSpecId] = useState(DEFAULT_SPEC)
  const [extra, setExtra] = useState<string[]>([])
  const [draft, setDraft] = useState("")

  const spec = SPECS.find((s) => s.id === specId) ?? SPECS[0]
  const { forbid } = combinePresets(presets)
  const tags = [...specTags(spec.tags, spec.certified), ...extra.filter((w) => !spec.tags.includes(w))]
  const local = forbid.length ? evaluate(forbid, tags) : null
  const server = useServerVerdict(forbid, tags)

  const togglePreset = (id: string, on: boolean) =>
    setPresets((current) => (on ? [...current, id] : current.filter((p) => p !== id)))
  const addWord = (event: FormEvent) => {
    event.preventDefault()
    const word = draft.trim()
    if (word && !extra.includes(word)) setExtra([...extra, word])
    setDraft("")
  }

  return (
    <section aria-labelledby="try-it" className="grid gap-6 rounded-xl border bg-card p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="flex flex-col gap-5">
        <h2 id="try-it" className="font-display text-xl font-semibold text-navy">
          Try it
        </h2>
        <fieldset className="flex flex-col gap-2">
          <legend className="pb-2 text-sm font-medium text-grey">Diets (pick one or more)</legend>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            {[...rules.presets.values()].map((p) => (
              <label key={p.id} className="flex min-h-8 cursor-pointer items-center gap-2 text-sm text-navy">
                <Checkbox checked={presets.includes(p.id)} onCheckedChange={(on) => togglePreset(p.id, on === true)} />
                {t(p.labels, lang)}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className="flex flex-col gap-2">
          <legend className="pb-2 text-sm font-medium text-grey">Dish on JL740 tonight</legend>
          <div className="flex flex-wrap gap-2">
            {SPECS.map((s) => (
              <Button
                key={s.id}
                type="button"
                variant="outline"
                size="sm"
                aria-pressed={s.id === specId}
                onClick={() => setSpecId(s.id)}
                className={cn("h-auto max-w-full py-1.5 text-left whitespace-normal", s.id === specId && "border-blue bg-ice text-navy")}
              >
                {s.code && <span className="font-mono text-xs text-grey">{s.code}</span>}
                {t(s.name, lang)}
              </Button>
            ))}
          </div>
        </fieldset>
        <form onSubmit={addWord} className="flex flex-col gap-2">
          <label htmlFor="extra-word" className="text-sm font-medium text-grey">
            Add an ingredient
          </label>
          <div className="flex gap-2">
            <Input id="extra-word" value={draft} maxLength={64} placeholder="e.g. 出汁, mirin, ghee" onChange={(e) => setDraft(e.target.value)} />
            <Button type="submit" variant="secondary" disabled={!draft.trim()}>
              <Plus /> Add
            </Button>
          </div>
          {extra.length > 0 && (
            <ul className="flex flex-wrap gap-1.5">
              {extra.map((w) => (
                <li key={w}>
                  <button
                    type="button"
                    onClick={() => setExtra(extra.filter((x) => x !== w))}
                    className="inline-flex items-center gap-1 rounded-md bg-ice px-2 py-0.5 text-xs text-navy hover:bg-line focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                    aria-label={`Remove ${w}`}
                  >
                    {w} <X className="size-3" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </form>
      </div>

      <div className="flex flex-col gap-4 rounded-lg bg-mist p-5" aria-live="polite">
        <div className="text-sm text-grey">{t(spec.name, lang)}</div>
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span key={tag} className="rounded-md border bg-card px-2 py-0.5 text-xs text-navy">
              {rules.tags.has(tag) ? label(tag, lang) : tag}
            </span>
          ))}
        </div>
        {local === null ? (
          <p className="text-sm text-grey">{t(STR.pickDiet, lang)}</p>
        ) : (
          <>
            <VerdictBadge verdict={local.verdict} lang={lang} size="lg" />
            {local.fired.length === 0 ? (
              <p className="text-sm text-grey">{t(STR.noRuleFired, lang)}</p>
            ) : (
              <ul aria-label="Rules that fired">
                {local.fired.map((f) => (
                  <FiredRow key={`${f.rule_id}-${f.via}`} fired={f} lang={lang} />
                ))}
              </ul>
            )}
            <ServerAgreement local={local} server={server} />
          </>
        )}
      </div>
    </section>
  )
}
