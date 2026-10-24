// Shown on a module's route until its owner ships the real page.
import { Construction } from "lucide-react"

import { cn } from "@/lib/utils"
import { Badge } from "@/ui/badge"

interface ModulePlaceholderProps {
  module: string
  title: string
  owner: string
  purpose: string
  route: string
  dark?: boolean
}

export function ModulePlaceholder({ module, title, owner, purpose, route, dark = false }: ModulePlaceholderProps) {
  return (
    <section className={cn("mx-auto flex max-w-2xl flex-col gap-4", !dark && "px-6 py-10")}>
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="font-mono">
          {module}
        </Badge>
        <span className="font-mono text-xs text-muted-foreground">{route}</span>
      </div>
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="text-muted-foreground">{purpose}</p>
      <div className="flex items-center gap-2 rounded-lg border bg-card px-4 py-3 text-sm">
        <Construction className="size-4 text-muted-foreground" aria-hidden="true" />
        <span>
          In progress · owner <strong className="font-medium">{owner}</strong> · spec in{" "}
          <code className="font-mono text-xs">docs/plan/modules/{module}-*.md</code>
        </span>
      </div>
    </section>
  )
}
