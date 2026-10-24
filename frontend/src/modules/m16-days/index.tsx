import type { ModuleRoute } from "@/app/types"
import { DaysPage } from "@/modules/m16-days/DaysPage"
import { OpsDaysPage } from "@/modules/m16-days/OpsDaysPage"

export const routes: ModuleRoute[] = [
  { path: "/p/days", layout: "mobile", element: <DaysPage /> },
  { path: "/ops/days", layout: "desktop", element: <OpsDaysPage /> },
]
