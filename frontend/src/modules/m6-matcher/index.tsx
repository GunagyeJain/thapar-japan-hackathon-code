import { ModulePlaceholder } from "@/app/ModulePlaceholder"
import type { ModuleRoute } from "@/app/types"

// m6 owns this folder. Replace the placeholders with the real pages; keep exporting `routes`.
export const routes: ModuleRoute[] = [
  {
    path: "/ops/late",
    layout: "desktop",
    element: (
      <ModulePlaceholder
        module="m6"
        route="/ops/late"
        owner="Gunagye"
        title="Late requests"
        purpose="Find a safe meal already on board for a last-minute request, and explain every alternative."
      />
    ),
  },
]
