// Crew tablet shell: dark cabin mode by default, landscape first, large touch targets.
import { Outlet } from "react-router"

import { Brand } from "@/app/layouts/Brand"

export function TabletLayout() {
  return (
    <div className="cabin min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card">
        <div className="flex h-14 items-center justify-between px-5">
          <Brand subtitle="客室乗務員 · Cabin crew" />
          <span className="text-sm text-muted-foreground tabular">JL740 · DEL → NRT</span>
        </div>
      </header>
      <main className="px-5 py-5">
        <Outlet />
      </main>
    </div>
  )
}
