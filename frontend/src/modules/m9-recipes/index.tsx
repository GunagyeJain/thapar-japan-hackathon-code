import type { ModuleRoute } from "@/app/types"

import { RecipePage } from "./RecipePage"

export const routes: ModuleRoute[] = [{ path: "/caterer/recipes", layout: "desktop", element: <RecipePage /> }]
