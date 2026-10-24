// /rules: diets as ingredient rules, a live check that names the rule that fired, and the parity count.
import { CircleCheck } from "lucide-react"
import { useState } from "react"

import { count as vectorCount } from "@shared/rules/vectors.json"
import { LANGS } from "@/lib/i18n"
import { loadRules } from "@/lib/rules"
import type { Lang } from "@/lib/types"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/ui/tabs"
import { CodesTable, DietsTable } from "@/modules/m1-rules/RulesTables"
import { TryIt } from "@/modules/m1-rules/TryIt"

function ParityLine() {
  return (
    <p className="flex items-center gap-2 rounded-md bg-safe-bg px-3 py-2 text-sm font-medium text-safe tabular">
      <CircleCheck className="size-4" aria-hidden="true" />
      {vectorCount} rule tests · server and offline tablet agree
    </p>
  )
}

export function RulesPage() {
  const [lang, setLang] = useState<Lang>("en")
  const rules = loadRules()
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-grey tabular">
            {rules.tags.size} ingredients · {rules.diets.size} diets · {rules.codes.length} meal codes
          </p>
          <h1 className="mt-1 text-[32px] leading-tight font-bold tracking-tight text-navy">Diet rules</h1>
          <p className="mt-1 text-grey">Every verdict names the rule that fired</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <ParityLine />
          <Tabs value={lang} onValueChange={(v) => setLang(v as Lang)}>
            <TabsList aria-label="Language">
              {LANGS.map((l) => (
                <TabsTrigger key={l.id} value={l.id}>
                  {l.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      </header>

      <TryIt lang={lang} />

      <Tabs defaultValue="diets" className="rounded-xl border bg-card p-5">
        <TabsList>
          <TabsTrigger value="diets">Diets</TabsTrigger>
          <TabsTrigger value="codes">JAL meal codes</TabsTrigger>
        </TabsList>
        <TabsContent value="diets">
          <DietsTable lang={lang} />
        </TabsContent>
        <TabsContent value="codes">
          <CodesTable lang={lang} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
