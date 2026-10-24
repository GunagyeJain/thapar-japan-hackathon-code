import type { ModuleRoute } from "@/app/types"
import { InsightsPage } from "@/modules/m10-insights/InsightsPage"

export const routes: ModuleRoute[] = [{ path: "/insights", layout: "desktop", element: <InsightsPage /> }]
