import type { ReactNode } from "react"

export type Surface = "desktop" | "mobile" | "tablet" | "web" // web: a bare page with its own chrome (m23 /jal)

/** What every module's index.tsx exports as `routes`. */
export interface ModuleRoute {
  path: string
  layout: Surface
  element: ReactNode
}
