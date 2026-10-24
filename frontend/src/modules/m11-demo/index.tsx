import { ModulePlaceholder } from "@/app/ModulePlaceholder"
import type { ModuleRoute } from "@/app/types"

// m11 owns this folder. Replace the placeholders with the real pages; keep exporting `routes`.
export const routes: ModuleRoute[] = [
  {
    path: "/demo",
    layout: "desktop",
    element: (
      <ModulePlaceholder
        module="m11"
        route="/demo"
        owner="Gunagye"
        title="Demo control"
        purpose="Step through the JL740 story and reset the data in under a second."
      />
    ),
  },
]
