import type { ModuleRoute } from "@/app/types"
import { CrewPage } from "@/modules/m8-crew/CrewPage"

export const routes: ModuleRoute[] = [{ path: "/crew", layout: "tablet", element: <CrewPage /> }]
