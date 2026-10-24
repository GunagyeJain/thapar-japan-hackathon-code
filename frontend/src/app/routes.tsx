// Route list. Shared zone: one import + one spread per module, add yours, don't reorder.
// Each module's index.tsx exports `routes: ModuleRoute[]`; the layout comes from `route.layout`.
import type { ComponentType } from "react"
import { createBrowserRouter, type RouteObject } from "react-router"

import { DesktopLayout } from "@/app/layouts/DesktopLayout"
import { MobileLayout } from "@/app/layouts/MobileLayout"
import { TabletLayout } from "@/app/layouts/TabletLayout"
import { NotFound } from "@/app/NotFound"
import type { ModuleRoute, Surface } from "@/app/types"
import { routes as m0 } from "@/modules/m0-home"
import { routes as m1 } from "@/modules/m1-rules"
import { routes as m2 } from "@/modules/m2-ui"
import { routes as m3 } from "@/modules/m3-passenger"
import { routes as m5 } from "@/modules/m5-ops"
import { routes as m6 } from "@/modules/m6-matcher"
import { routes as m7 } from "@/modules/m7-caterer"
import { routes as m8 } from "@/modules/m8-crew"
import { routes as m9 } from "@/modules/m9-recipes"
import { routes as m10 } from "@/modules/m10-insights"
import { routes as m11 } from "@/modules/m11-demo"
import { routes as m14 } from "@/modules/m14-groups"
import { routes as m16 } from "@/modules/m16-days"
import { routes as m21 } from "@/modules/m21-sun"

const MODULE_ROUTES: ModuleRoute[] = [
  ...m0,
  ...m1,
  ...m2,
  ...m3,
  ...m5,
  ...m6,
  ...m7,
  ...m8,
  ...m9,
  ...m10,
  ...m11,
  ...m14,
  ...m16,
  ...m21,
]

const LAYOUTS: Record<Surface, ComponentType> = {
  desktop: DesktopLayout,
  mobile: MobileLayout,
  tablet: TabletLayout,
}

function byLayout(layout: Surface): RouteObject {
  const Layout = LAYOUTS[layout]
  return {
    element: <Layout />,
    children: MODULE_ROUTES.filter((r) => r.layout === layout).map((r) => ({ path: r.path, element: r.element })),
  }
}

export const router = createBrowserRouter([
  byLayout("desktop"),
  byLayout("mobile"),
  byLayout("tablet"),
  { element: <DesktopLayout />, children: [{ path: "*", element: <NotFound /> }] },
])
