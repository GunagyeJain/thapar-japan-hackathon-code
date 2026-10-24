import type { ModuleRoute } from "@/app/types"
import { DemoPage } from "@/modules/m11-demo/DemoPage"

export const routes: ModuleRoute[] = [{ path: "/demo", layout: "desktop", element: <DemoPage /> }]
