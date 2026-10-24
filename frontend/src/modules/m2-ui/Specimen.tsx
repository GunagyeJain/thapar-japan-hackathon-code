// One gallery entry: the component in light and in cabin dark, side by side.
import type { ReactNode } from "react"

import { CabinTheme } from "@/ui"

interface SpecimenProps {
  name: string
  usage: string
  children: ReactNode
  dark?: boolean
}

export function Specimen({ name, usage, children, dark = true }: SpecimenProps) {
  return (
    <section className="flex flex-col gap-3" aria-labelledby={`spec-${name}`}>
      <div>
        <h2 id={`spec-${name}`} className="text-base font-semibold">
          {name}
        </h2>
        <code className="code text-xs text-muted-foreground">{usage}</code>
      </div>
      <div className={dark ? "grid min-w-0 gap-3 xl:grid-cols-2" : "grid min-w-0"}>
        <div className="flex min-w-0 flex-wrap items-center gap-3 rounded-xl border bg-card p-5">{children}</div>
        {dark && (
          <CabinTheme className="flex min-w-0 flex-wrap items-center gap-3 rounded-xl border p-5">{children}</CabinTheme>
        )}
      </div>
    </section>
  )
}
