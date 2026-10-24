// Desktop shell: left nav, the JL740 context bar, then the page.
import { NavLink, Outlet } from "react-router"

import { NAV, NAV_GROUPS } from "@/app/nav"
import { Brand } from "@/app/layouts/Brand"
import { cn } from "@/lib/utils"
import { FlightContextBar } from "@/ui/FlightContextBar"

function SideNav() {
  return (
    <nav aria-label="Main" className="flex flex-col gap-5">
      {NAV_GROUPS.map((group) => (
        <div key={group}>
          <div className="px-3 pb-1.5 text-[11px] font-medium uppercase tracking-wider text-white/50">{group}</div>
          <ul className="flex flex-col gap-0.5">
            {NAV.filter((n) => n.group === group).map((n) => (
              <li key={n.to}>
                <NavLink
                  to={n.to}
                  end
                  className={({ isActive }) =>
                    cn(
                      "flex h-9 items-center gap-2.5 rounded-md px-3 text-sm text-white/80 transition-colors duration-150 hover:bg-white/10 hover:text-white",
                      isActive && "bg-white/12 font-medium text-white",
                    )
                  }
                >
                  <n.icon className="size-4 shrink-0" aria-hidden="true" />
                  {n.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  )
}

export function DesktopLayout() {
  return (
    <div className="min-h-screen md:grid md:grid-cols-[232px_1fr]">
      <aside className="sticky top-0 hidden h-screen flex-col gap-6 overflow-y-auto bg-navy px-3 py-5 text-white md:flex">
        <Brand className="px-2 text-white" />
        <SideNav />
        <p className="mt-auto px-3 text-[11px] leading-relaxed text-white/50">Read-only copy of the PNL/ADL feed. A person approves every fix.</p>
      </aside>
      <header className="flex items-center gap-4 overflow-x-auto bg-navy px-4 py-3 text-white md:hidden">
        <Brand className="shrink-0 text-white" />
        {NAV.filter((n) => n.surface === "desktop" && n.to !== "/").map((n) => (
          <NavLink key={n.to} to={n.to} end className="shrink-0 text-sm text-white/80">
            {n.label}
          </NavLink>
        ))}
      </header>
      <main className="min-w-0">
        <FlightContextBar className="sticky top-0 z-30" />
        <Outlet />
      </main>
    </div>
  )
}
