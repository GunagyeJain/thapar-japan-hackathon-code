// The guide bar on every projector screen while the story runs: which act we're in, what this screen is,
// what to click here, and where Priya's meal promise stands. Hidden on /demo (it has the full cockpit).
import { ChevronDown, ChevronUp, Compass, MousePointerClick } from "lucide-react"
import { useState } from "react"
import { Link, useLocation } from "react-router"

import { t } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { PromiseSteps } from "@/ui"
import { usePriya, useScenario, when } from "@/modules/m11-demo/data"
import { CUES, ON_DEVICE } from "@/modules/m11-demo/script"

const HIDE_KEY = "thalibento.guide-hidden"

/** Folded unless the presenter opened it: the bar alone says which act we're in. */
function readHidden(): boolean {
  try {
    return localStorage.getItem(HIDE_KEY) !== "0"
  } catch {
    return true
  }
}

export function StoryGuide() {
  const { pathname } = useLocation()
  const scenario = useScenario()
  const priya = usePriya()
  const [hidden, setHidden] = useState(readHidden)
  const toggle = () => {
    setHidden(!hidden)
    try {
      localStorage.setItem(HIDE_KEY, hidden ? "0" : "1")
    } catch {
      // private mode: the choice lasts until reload
    }
  }

  const data = scenario.data
  const started = data ? data.current > 0 || data.steps[0]?.done : false
  if (!data || !started || pathname.startsWith("/demo")) return null
  const step = data.steps[data.current]
  const cue = CUES[step.n]
  const here = cue && pathname.startsWith(cue.screen) && cue.device === "projector"
  const handoff = cue?.handoff && cue.handoff !== "LATE" ? cue.handoff : null

  return (
    <section aria-label="Story guide" className="border-b border-sky/40 bg-ice/70 dark:bg-secondary">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-6 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <Compass className="size-4 shrink-0 text-blue" aria-hidden="true" />
          <span className="text-sm font-semibold whitespace-nowrap">
            Act {step.act} · {when(step)}
          </span>
          <span className="truncate text-sm">{t(step.title, "en")}</span>
        </div>
        {priya.data?.promise && (
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs whitespace-nowrap text-muted-foreground">Priya's meal</span>
            <PromiseSteps checkpoints={priya.data.promise.checkpoints} compact current={handoff} className="w-[22rem]" />
          </div>
        )}
        <button
          type="button"
          onClick={toggle}
          className={cn("flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-white/60", !priya.data?.promise && "ml-auto")}
          aria-expanded={!hidden}
        >
          {hidden ? <ChevronDown className="size-3.5" /> : <ChevronUp className="size-3.5" />} {hidden ? "Show guide" : "Hide guide"}
        </button>
      </div>
      {!hidden && (
        <div className="mx-auto max-w-7xl px-6 pb-3 text-sm">
          {cue && (
            <p className="flex items-start gap-1.5">
              <MousePointerClick className="mt-0.5 size-4 shrink-0 text-blue" aria-hidden="true" />
              <span>
                <span className="font-semibold">{here ? "Do here: " : `Now on ${ON_DEVICE[cue.device]}: `}</span>
                {cue.steps.join(" ")}{" "}
                <Link to="/demo" className="font-medium text-blue underline-offset-2 hover:underline">
                  Demo control
                </Link>
              </span>
            </p>
          )}
        </div>
      )}
    </section>
  )
}
