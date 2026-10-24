// A promise's journey C1 → C5: one row per checkpoint event, the breakpoint called out.
import { CheckCircle2, Clock, Info, Wrench, XCircle, type LucideIcon } from "lucide-react"

import { fmtTime } from "@/lib/format"
import { t } from "@/lib/i18n"
import type { CheckpointEvent, Lang, Text } from "@/lib/types"
import { cn } from "@/lib/utils"
import { StatusChip } from "@/ui/StatusChip"

export const CHECKPOINT_LABELS: Record<CheckpointEvent["checkpoint"], Text> = {
  C1: { en: "Diet captured", ja: "食事情報の登録", hi: "भोजन जानकारी दर्ज" },
  C2: { en: "Booking feed (PNL/ADL)", ja: "予約データ（PNL/ADL）", hi: "बुकिंग फ़ीड" },
  C3: { en: "Caterer list", ja: "ケータリング発注", hi: "कैटरर सूची" },
  C4: { en: "Loaded in galley", ja: "ギャレー搭載", hi: "गैली में लोड" },
  C5: { en: "Served at seat", ja: "座席で提供", hi: "सीट पर परोसा" },
  LATE: { en: "Late request", ja: "直前リクエスト", hi: "देर से अनुरोध" },
}

const RESULTS: Record<CheckpointEvent["result"], { icon: LucideIcon; tone: string; label: string }> = {
  ok: { icon: CheckCircle2, tone: "text-safe", label: "OK" },
  fail: { icon: XCircle, tone: "text-unsafe", label: "Failed" },
  fixed: { icon: Wrench, tone: "text-safe", label: "Fixed" },
  info: { icon: Info, tone: "text-sky", label: "Note" },
}

export interface TimelineProps {
  events: CheckpointEvent[]
  breakpoint?: { checkpoint: string; at: string; detail: string } | null
  lang?: Lang
  className?: string
}

export function Timeline({ events, breakpoint, lang = "en", className }: TimelineProps) {
  const ordered = [...events].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
  if (ordered.length === 0) {
    return (
      <p className={cn("flex items-center gap-2 text-sm text-muted-foreground", className)}>
        <Clock className="size-4" aria-hidden="true" /> No checkpoints yet. C1 appears when the diet is captured.
      </p>
    )
  }
  return (
    <ol className={cn("relative flex flex-col", className)}>
      {ordered.map((ev, i) => {
        const r = RESULTS[ev.result]
        const isBreak = breakpoint != null && breakpoint.checkpoint === ev.checkpoint && breakpoint.at === ev.at
        const last = i === ordered.length - 1
        return (
          <li key={ev.id} className="relative grid grid-cols-[28px_1fr] gap-x-3 pb-5 last:pb-0">
            {!last && <span className="absolute top-7 bottom-0 left-[13px] w-px bg-border" aria-hidden="true" />}
            <span className={cn("relative z-10 flex size-7 items-center justify-center rounded-full bg-card", r.tone)}>
              <r.icon className="size-5" aria-label={r.label} />
            </span>
            <div className={cn("min-w-0", isBreak && "rounded-lg border border-unsafe/40 bg-unsafe-bg/60 p-3")}>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="code text-xs font-semibold">{ev.checkpoint}</span>
                <span className="font-medium">{t(CHECKPOINT_LABELS[ev.checkpoint], lang)}</span>
                <span className={cn("text-xs font-medium", r.tone)}>{r.label}</span>
                {isBreak && <StatusChip status="unsafe" size="sm" label="Breakpoint" />}
                <span className="ml-auto text-xs text-muted-foreground tabular">
                  {fmtTime(ev.at, "IST", { date: true })} · {fmtTime(ev.at, "JST")}
                </span>
              </div>
              <p className="mt-0.5 text-sm text-muted-foreground">{ev.detail}</p>
              <p className="code mt-0.5 text-[11px] text-muted-foreground/80">{ev.source}</p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
