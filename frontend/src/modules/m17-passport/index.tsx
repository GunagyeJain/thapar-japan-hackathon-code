import type { ModuleRoute } from "@/app/types"

import { ChatPage } from "./ChatPage"

export const routes: ModuleRoute[] = [{ path: "/chat", layout: "mobile", element: <ChatPage /> }]
