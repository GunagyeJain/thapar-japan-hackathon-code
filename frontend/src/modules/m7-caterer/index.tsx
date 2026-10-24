import type { ModuleRoute } from "@/app/types"
import { CatererPage } from "@/modules/m7-caterer/CatererPage"
import { LabelsPage } from "@/modules/m7-caterer/LabelsPage"

export const routes: ModuleRoute[] = [
  { path: "/caterer", layout: "desktop", element: <CatererPage /> },
  { path: "/caterer/labels", layout: "desktop", element: <LabelsPage /> },
]
