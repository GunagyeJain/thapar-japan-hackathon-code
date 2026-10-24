// Before / after lines (manifest rows, meal-list lines, PNL vs ADL), as one unified diff.
import { cn } from "@/lib/utils"

type Op = { kind: "same" | "add" | "remove"; line: string }

/** Line diff by longest common subsequence; fine for messages and meal lists (hundreds of lines). */
export function diffLines(before: string[], after: string[]): Op[] {
  const n = before.length
  const m = after.length
  const lcs = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = before[i] === after[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1])
    }
  }
  const ops: Op[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (before[i] === after[j]) {
      ops.push({ kind: "same", line: before[i] })
      i++
      j++
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      ops.push({ kind: "remove", line: before[i++] })
    } else {
      ops.push({ kind: "add", line: after[j++] })
    }
  }
  while (i < n) ops.push({ kind: "remove", line: before[i++] })
  while (j < m) ops.push({ kind: "add", line: after[j++] })
  return ops
}

export interface DiffViewProps {
  before: string[]
  after: string[]
  beforeLabel?: string
  afterLabel?: string
  /** Hide unchanged lines. */
  changesOnly?: boolean
  className?: string
}

const ROW = {
  same: { className: "text-muted-foreground", sign: " " },
  add: { className: "bg-safe-bg text-safe", sign: "+" },
  remove: { className: "bg-unsafe-bg text-unsafe", sign: "−" },
}

export function DiffView({ before, after, beforeLabel = "Before", afterLabel = "After", changesOnly = false, className }: DiffViewProps) {
  const ops = diffLines(before, after)
  const shown = changesOnly ? ops.filter((o) => o.kind !== "same") : ops
  const added = ops.filter((o) => o.kind === "add").length
  const removed = ops.filter((o) => o.kind === "remove").length
  return (
    <figure className={cn("overflow-hidden rounded-xl border bg-card", className)}>
      <figcaption className="flex items-center gap-3 border-b bg-muted/60 px-4 py-2 text-xs text-muted-foreground">
        <span className="font-medium">
          {beforeLabel} → {afterLabel}
        </span>
        <span className="text-safe tabular">+{added}</span>
        <span className="text-unsafe tabular">−{removed}</span>
      </figcaption>
      <pre className="code overflow-x-auto py-2 text-[13px] leading-6">
        {shown.length === 0 ? (
          <div className="px-4 text-muted-foreground">No changes</div>
        ) : (
          shown.map((o, i) => (
            <div key={i} className={cn("flex px-4", ROW[o.kind].className)}>
              <span className="w-5 shrink-0 select-none" aria-hidden="true">
                {ROW[o.kind].sign}
              </span>
              <span className="whitespace-pre">{o.line || " "}</span>
            </div>
          ))
        )}
      </pre>
    </figure>
  )
}
