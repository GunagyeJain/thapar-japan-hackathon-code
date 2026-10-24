// A meal promise's five hand-offs, C1 → C5, each with its state as icon + word.
// "row" fits a board or a guide bar; "column" fits a phone.
import { CheckCircle2, Circle, Wrench, XCircle, type LucideIcon } from "lucide-react"

import { t } from "@/lib/i18n"
import type { CheckpointId, CheckpointState, Lang, Text } from "@/lib/types"
import { cn } from "@/lib/utils"
import { CHECKPOINT_LABELS } from "@/ui/Timeline"

export const CHECKPOINTS: CheckpointId[] = ["C1", "C2", "C3", "C4", "C5"]

/** Short names for the five hand-offs, for tight spaces. */
export const CHECKPOINT_SHORT: Record<CheckpointId, Text> = {
  C1: { en: "Diet", ja: "食事情報", hi: "भोजन" },
  C2: { en: "Booking", ja: "予約", hi: "बुकिंग" },
  C3: { en: "Caterer", ja: "ケータリング", hi: "कैटरर" },
  C4: { en: "Galley", ja: "ギャレー", hi: "गैली" },
  C5: { en: "Seat", ja: "座席", hi: "सीट" },
}

const STATES: Record<CheckpointState, { icon: LucideIcon; tone: string; word: Text }> = {
  ok: { icon: CheckCircle2, tone: "text-safe", word: { en: "Done", ja: "完了", hi: "पूरा" } },
  fixed: { icon: Wrench, tone: "text-safe", word: { en: "Fixed", ja: "修正済", hi: "ठीक किया" } },
  fail: { icon: XCircle, tone: "text-unsafe", word: { en: "Problem", ja: "問題あり", hi: "समस्या" } },
  pending: { icon: Circle, tone: "text-muted-foreground", word: { en: "Waiting", ja: "待機中", hi: "बाकी" } },
}

export interface PromiseStepsProps {
  checkpoints: Partial<Record<CheckpointId, CheckpointState>>
  orientation?: "row" | "column"
  /** Short names and small type, for table cells. */
  compact?: boolean
  /** The hand-off the story is at now: outlined. */
  current?: CheckpointId | null
  lang?: Lang
  className?: string
}

export function PromiseSteps({ checkpoints, orientation = "row", compact = false, current, lang = "en", className }: PromiseStepsProps) {
  return (
    <ol
      className={cn(orientation === "row" ? "flex items-stretch gap-1" : "flex flex-col gap-1.5", className)}
      aria-label={t({ en: "Meal promise hand-offs", ja: "受け渡しの状況", hi: "भोजन वादे के पड़ाव" }, lang)}
    >
      {CHECKPOINTS.map((c) => {
        const state = checkpoints[c] ?? "pending"
        const { icon: Icon, tone, word } = STATES[state]
        const name = t(compact ? CHECKPOINT_SHORT[c] : CHECKPOINT_LABELS[c], lang)
        return (
          <li
            key={c}
            aria-current={current === c ? "step" : undefined}
            className={cn(
              "flex min-w-0 items-center gap-2 rounded-md border border-transparent",
              orientation === "row" ? "flex-1 flex-col gap-0.5 px-1.5 py-1 text-center" : "px-3 py-2",
              orientation === "column" && "border-border bg-card",
              current === c && "border-blue bg-ice/60 dark:bg-secondary",
            )}
          >
            <Icon className={cn("shrink-0", tone, compact ? "size-4" : "size-5")} aria-hidden="true" />
            <span className={cn("min-w-0", orientation === "column" && "flex-1")}>
              <span className={cn("block font-medium", compact ? "text-[11px] leading-tight" : "text-sm")}>
                <span className="text-muted-foreground tabular">{c}</span> {name}
              </span>
              <span className={cn("block", tone, compact ? "text-[10px] leading-tight" : "text-xs")}>{t(word, lang)}</span>
            </span>
          </li>
        )
      })}
    </ol>
  )
}
