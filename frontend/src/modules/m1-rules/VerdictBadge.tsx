// Verdict as icon + word. Swap for m2's ui/VerdictBadge once it lands.
import { CircleCheck, CircleHelp, CircleX } from "lucide-react"

import { t } from "@/lib/i18n"
import type { Verdict } from "@/lib/rules"
import type { Lang } from "@/lib/types"
import { cn } from "@/lib/utils"
import { Badge } from "@/ui/badge"
import { STR } from "@/modules/m1-rules/i18n"

const LOOK = {
  SAFE: { variant: "safe", Icon: CircleCheck },
  UNSAFE: { variant: "unsafe", Icon: CircleX },
  NEEDS_HUMAN: { variant: "warn", Icon: CircleHelp },
} as const

export function VerdictBadge({ verdict, lang = "en", large = false }: { verdict: Verdict; lang?: Lang; large?: boolean }) {
  const { variant, Icon } = LOOK[verdict]
  return (
    <Badge variant={variant} className={cn(large && "px-3 py-1 text-sm [&>svg]:size-4")}>
      <Icon aria-hidden="true" />
      {t(STR.verdict[verdict], lang)}
    </Badge>
  )
}
