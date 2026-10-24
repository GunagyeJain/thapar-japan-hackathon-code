import type { ReactNode } from "react"

export type Surface = "desktop" | "mobile" | "tablet"

/** What every module's index.tsx exports as `routes`. */
export interface ModuleRoute {
  path: string
  layout: Surface
  element: ReactNode
}
