// Phone shell for /p and /j: one column, 16 px gutters. Pages pin their primary action at the bottom.
import { Outlet } from "react-router"

import { Brand } from "@/app/layouts/Brand"

export function MobileLayout() {
  return (
    <div className="min-h-screen bg-mist">
      <header className="bg-navy text-white">
        <div className="mx-auto flex h-14 max-w-md items-center justify-between px-4">
          <Brand subtitle="Japan Airlines · JL740" partner={false} />
        </div>
      </header>
      <main className="mx-auto max-w-md px-4 pt-4 pb-28 text-base">
        <Outlet />
      </main>
    </div>
  )
}
