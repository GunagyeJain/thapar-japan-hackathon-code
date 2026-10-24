import type { ModuleRoute } from "@/app/types"

import { JalPage } from "./JalPage"

export const routes: ModuleRoute[] = [{ path: "/jal", layout: "web", element: <JalPage /> }]
