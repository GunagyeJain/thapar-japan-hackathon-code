// Read-back chips: "No meat, fish, egg · No onion or garlic · Dairy OK".
import { Ban, Check, TriangleAlert, type LucideIcon } from "lucide-react"

import type { Lang } from "@/lib/types"
import { cn } from "@/lib/utils"

import { summaryChips, type SummaryChip } from "./diet"
import { pick, s } from "./i18n"
import type { DietValue } from "./types"

const TONE: Record<SummaryChip["tone"], { icon: LucideIcon; className: string }> = {
  no: { icon: Ban, className: "border-line bg-card text-navy" },
  allergy: { icon: TriangleAlert, className: "border-warn/30 bg-warn-bg text-warn" },
  ok: { icon: Check, className: "border-safe/30 bg-safe-bg text-safe" },
}

export function DietSummary({ value, lang, className }: { value: DietValue; lang: Lang; className?: string }) {
  const chips = summaryChips(value)
  if (!chips.length) return <p className={cn("text-sm text-grey", className)}>{pick(s.picker.nothing, lang)}</p>
  return (
    <ul lang={lang} className={cn("flex flex-wrap gap-2", className)}>
      {chips.map((c) => {
        const { icon: Icon, className: tone } = TONE[c.tone]
        return (
          <li key={c.id} className={cn("inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-sm font-medium", tone)}>
            <Icon aria-hidden="true" className="size-4 shrink-0" />
            {pick(c.text, lang)}
          </li>
        )
      })}
    </ul>
  )
}
