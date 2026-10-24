import type { ModuleRoute } from "@/app/types"
import { HomePage } from "@/modules/m0-home/HomePage"

export const routes: ModuleRoute[] = [{ path: "/", layout: "desktop", element: <HomePage /> }]
