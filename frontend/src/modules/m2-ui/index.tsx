import type { ModuleRoute } from "@/app/types"
import { UiGallery } from "@/modules/m2-ui/UiGallery"

export const routes: ModuleRoute[] = [{ path: "/ui", layout: "desktop", element: <UiGallery /> }]
