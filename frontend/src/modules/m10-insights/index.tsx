import { ModulePlaceholder } from "@/app/ModulePlaceholder"
import type { ModuleRoute } from "@/app/types"

// m10 owns this folder. Replace the placeholders with the real pages; keep exporting `routes`.
export const routes: ModuleRoute[] = [
  {
    path: "/insights",
    layout: "desktop",
    element: (
      <ModulePlaceholder
        module="m10"
        route="/insights"
        owner="Bhavyam"
        title="Insights"
        purpose="Every promise's C1–C5 timeline, and where it nearly broke."
      />
    ),
  },
]
