// The presenter's script, step by step (from docs/demo-script.md): where to look, what to click, what to say,
// and what the room should notice. /demo shows all of it; the guide bar on each screen shows the short version.
import type { CheckpointId } from "@/lib/types"

export type Device = "projector" | "phone" | "ipad"

export interface Cue {
  /** Where the action happens and the screen to open there. */
  device: Device
  screen: string
  /** The clicks, in order. */
  steps: string[]
  /** The narrator's line. */
  say: string
  /** What the audience should notice. */
  sees: string
  /** The hand-off of Priya's meal promise this step is about (LATE = the gate desk). */
  handoff: CheckpointId | "LATE" | null
}

export const DEVICES: Record<Device, string> = {
  projector: "Projector laptop",
  phone: "Priya's phone",
  ipad: "Crew iPad",
}

/** "Now on …" in a sentence. */
export const ON_DEVICE: Record<Device, string> = {
  projector: "the projector",
  phone: "Priya's phone",
  ipad: "the crew iPad",
}

export const CUES: Record<number, Cue> = {
  0: {
    device: "projector",
    screen: "/demo",
    steps: ["Start: reset to 23 Oct 18:00.", "Point at the line: 24 Oct 03:35.", "Judges scan the QR."],
    say: "81% of Indians limit meat, many only on certain days. JAL asks about meals once, 25 hours before take-off; most changes come later. In 2013 a Delhi court made JAL pay ₹35,000 for a wrong meal.",
    sees: "The ladder: \"Today, the airline stops listening here\".",
    handoff: null,
  },
  1: {
    device: "phone",
    screen: "/jal",
    steps: [
      "/jal → My Booking: 6XK2QP · SHARMA → Find booking.",
      "Special meal: tick Vegetarian, Onion & garlic, Purnima fast.",
      "Save meal.",
    ],
    say: "Priya doesn't need to know meal codes. Inside JAL's own My Booking she ticks what she doesn't eat. The rules pick AVML with no onion and no garlic.",
    sees: "Your meal: AVML · NO ONION NO GARLIC.",
    handoff: "C1",
  },
  2: {
    device: "phone",
    screen: "/jal/meal?passenger=PX-0057",
    steps: ["Same page: the question about Sun 25 Oct.", "Tap Yes, fasting meal."],
    say: "Her flight leaves on Sharad Purnima, a fast day. The Calendar Radar asks now, a day before the cutoff, and the kitchen gets the fasting meal in time.",
    sees: "\"…falls on Sharad Purnima. Keeping the fast?\" → the fasting version.",
    handoff: "C1",
  },
  3: {
    device: "projector",
    screen: "/ops/changes",
    steps: ["Run Chaos Mode.", "Click 23C, 31K and 38G on the ladder."],
    say: "The night before the flight: seven late changes. Each takes the best fix still possible at that minute; the right column is what happens today.",
    sees: "Seven dots on their rungs; Today mostly not met.",
    handoff: "LATE",
  },
  4: {
    device: "ipad",
    screen: "/crew",
    steps: [
      "Download for flight.",
      "Copilot → Ask seats now; /seat?seat=23C → Yes.",
      "Airplane mode → tap 2A; galley check 27D → Use backup.",
      "Seat service 23C: CTUS6P red, 7K2Q9F green.",
    ],
    say: "Before the meal every seat with a special meal asks: still right? Then offline, the copilot tells crew in Japanese who eats what and when the sun allows. A wrong tray is stopped at the seat.",
    sees: "23C confirmed at seat; 2A may eat from 06:30; red then green.",
    handoff: "C5",
  },
  5: {
    device: "projector",
    screen: "/ops/changes",
    steps: ["Metrics strip on /ops/changes.", "Then /ops/load."],
    say: "Same seven events: every strict need met, nothing thrown away, against one of five today. The reserve is a shelf-stable plate that suits 13 of 13 diets.",
    sees: "5/5 vs 1/5; 0 vs 2 meals thrown away; 13 of 13.",
    handoff: null,
  },
}

/** One line on what each screen is, for the guide bar. Longest matching prefix wins. */
const SCREENS: [string, string][] = [
  ["/ops/changes", "Change control: every late change, the rung of the ladder it took, what the passenger was told, and what today's process would have done."],
  ["/ops/desk", "Change desk: check-in, lounge, gate and crew log a late need; the router answers with the best fix still possible."],
  ["/ops/load", "Smart load: the cabin's diets (told and forecast), a reserve that never goes bad, and the universal plate."],
  ["/ops/sun", "Sun at the aircraft: when passengers who eat only in daylight may eat, at the aircraft's real position."],
  ["/ops/alerts", "Alert: the booking lines before and after the change, the deadline, and the fix a person approves."],
  ["/ops/late", "Late requests at the gate: every meal already on board, checked against the passenger's own food rules."],
  ["/ops", "Ops console: Delhi ground staff. The watcher reads every passenger list from the booking system and raises an alert when a special meal is missing or wrong."],
  ["/caterer/labels", "Tray labels: each carries a code and the food rules, not a seat, because seats change after the truck leaves."],
  ["/caterer", "Caterer portal: the kitchen gets numbered meal lists with every change spelled out, and acknowledges each one."],
  ["/insights", "Insights: every meal promise, hand-off by hand-off: where it broke and how fast it was fixed."],
  ["/demo", "Demo control: steps the flight clock through the story and says who clicks what."],
  ["/seat", "Seat screen: before the meal, each seat with a special or held meal asks \"still right?\"; the answer reaches the crew tablet over the cabin network."],
  ["/jal", "JAL booking concept: where ThaliBento plugs into Manage booking → Special meal. Not a Japan Airlines website."],
]

export function screenHelp(path: string): string | null {
  return SCREENS.find(([prefix]) => path.startsWith(prefix))?.[1] ?? null
}
