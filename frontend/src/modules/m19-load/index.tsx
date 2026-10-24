import type { ModuleRoute } from "@/app/types"
import { LoadPage } from "@/modules/m19-load/LoadPage"

export const routes: ModuleRoute[] = [{ path: "/ops/load", layout: "desktop", element: <LoadPage /> }]
