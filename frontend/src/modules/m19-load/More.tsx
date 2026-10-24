// A closed "more" section: method, assumptions and other detail for questions, out of the way of the demo.
import { ChevronRight } from "lucide-react"
import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

export function More({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <details className={cn("group rounded-lg border bg-card", className)}>
      <summary className="flex cursor-pointer list-none items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
        <ChevronRight className="size-4 transition-transform duration-150 group-open:rotate-90" aria-hidden="true" />
        {title}
      </summary>
      <div className="flex flex-col gap-3 px-4 pb-4 text-sm">{children}</div>
    </details>
  )
}
