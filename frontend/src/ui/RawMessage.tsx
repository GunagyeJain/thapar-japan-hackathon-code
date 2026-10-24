// A PNL/ADL as the teletype sent it, with line numbers and highlighted lines.
import { cn } from "@/lib/utils"

export type LineTone = "add" | "remove" | "mark"

export interface RawMessageProps {
  text: string
  title?: string
  /** 1-based line numbers to highlight. */
  highlight?: Record<number, LineTone>
  className?: string
}

const TONES: Record<LineTone, { row: string; sign: string }> = {
  add: { row: "bg-safe-bg text-safe", sign: "+" },
  remove: { row: "bg-unsafe-bg text-unsafe line-through decoration-unsafe/50", sign: "−" },
  mark: { row: "bg-warn-bg text-warn", sign: "›" },
}

export function RawMessage({ text, title, highlight = {}, className }: RawMessageProps) {
  const lines = text.replace(/\r\n/g, "\n").replace(/\n$/, "").split("\n")
  return (
    <figure className={cn("overflow-hidden rounded-xl border bg-card", className)}>
      {title && <figcaption className="border-b bg-muted/60 px-4 py-2 text-xs font-medium text-muted-foreground">{title}</figcaption>}
      <pre className="code overflow-x-auto py-2 text-[13px] leading-6">
        {lines.map((line, i) => {
          const tone = highlight[i + 1]
          return (
            <div key={i} className={cn("flex px-4", tone && TONES[tone].row)}>
              <span className="w-8 shrink-0 text-right text-muted-foreground/60 select-none">{i + 1}</span>
              <span className="w-5 shrink-0 text-center select-none" aria-hidden="true">
                {tone ? TONES[tone].sign : ""}
              </span>
              <span className="whitespace-pre">{line || " "}</span>
            </div>
          )
        })}
      </pre>
    </figure>
  )
}
