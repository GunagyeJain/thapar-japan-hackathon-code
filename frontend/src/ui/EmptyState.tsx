// Says what will appear here and when, never just "No data".
import { Inbox, type LucideIcon } from "lucide-react"
import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

export interface EmptyStateProps {
  title: ReactNode
  body?: ReactNode
  icon?: LucideIcon
  action?: ReactNode
  className?: string
}

export function EmptyState({ title, body, icon: Icon = Inbox, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-10 text-center", className)}>
      <span className="rounded-full bg-muted p-3 text-muted-foreground">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <p className="font-medium">{title}</p>
      {body && <p className="max-w-sm text-sm text-muted-foreground">{body}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
