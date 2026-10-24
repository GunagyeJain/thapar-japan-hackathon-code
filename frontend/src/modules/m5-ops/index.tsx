import type { ModuleRoute } from "@/app/types"
import { AlertDetail } from "@/modules/m5-ops/AlertDetail"
import { OpsBoard } from "@/modules/m5-ops/OpsBoard"

export const routes: ModuleRoute[] = [
  { path: "/ops", layout: "desktop", element: <OpsBoard /> },
  { path: "/ops/alerts/:id", layout: "desktop", element: <AlertDetail /> },
]
