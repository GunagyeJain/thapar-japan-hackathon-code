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
    steps: ["Press Start: reset to 23 Oct 18:00.", "Point at the ladder: the line at 24 Oct 03:35.", "Leave the judge QR up while the judges join."],
    say: "81% of Indians limit meat in some way, and many only on certain days or festivals. JAL asks about meals once, 25 hours before take-off, and three of the four touchpoints in your brief come after that line. In 2013 a Delhi consumer commission made JAL itself pay ₹35,000 for a wrong meal. Judges: scan the QR and join JL740.",
    sees: "The cutoff ladder with \"Today, the airline stops listening here\", and \"N joined\" ticking up.",
    handoff: null,
  },
  1: {
    device: "phone",
    screen: "/chat",
    steps: [
      "Open /chat?pnr=6XK2QP&surname=SHARMA.",
      "Type or say: pure veg, no onion-garlic, aur Purnima ka vrat rakhti hoon.",
      "Check the chips, press That's right.",
    ],
    say: "Priya doesn't pick a meal code or fill a form. She says it her way, in Hinglish. Every chip shows which of her words it came from; she confirms. The rules pick AVML with no onion, no garlic. We keep her food rules, never her religion.",
    sees: "Chips with \"lahsun → garlic\", \"Purnima → fasting days\"; then JL740: AVML + NO ONION NO GARLIC.",
    handoff: "C1",
  },
  2: {
    device: "phone",
    screen: "/chat",
    steps: ["Wait for the Radar's question about Sun 25 Oct.", "Tap Yes, fasting meal."],
    say: "Her flight leaves on Sharad Purnima, a fast day. Today she would remember at the gate, when nobody can help. The Calendar Radar asks her now, a day before the cutoff, with one tap, and the kitchen gets a fasting meal in time.",
    sees: "The question with two buttons, then \"Done: AVML + NO GRAIN NO LENTILS OR BEANS NO ONION NO GARLIC\".",
    handoff: "C1",
  },
  3: {
    device: "projector",
    screen: "/ops/changes",
    steps: ["Press Run Chaos Mode.", "Click two or three events on the ladder: the lost codeshare meal, Mehta at the gate, the run-out."],
    say: "Now the night before the flight, compressed. Seven late changes: a family member who never ordered, a codeshare rebooking that drops Priya's meal, a diabetic at check-in, a Jain request at the gate, a no-show, a change of mind on board, and the veg running out at the back. Each one takes the best fix still physically possible at that minute, and the passenger is told honestly. The right column is what happens today.",
    sees: "Seven dots on the ladder, each on its rung: caterer list, standby uplift, onboard spare, reserve pouch, flex swap; the Today column mostly red.",
    handoff: "LATE",
  },
  4: {
    device: "ipad",
    screen: "/crew",
    steps: [
      "Download for flight, then airplane mode.",
      "Copilot: show the seat map by strictness and tap 2A (her card in Japanese, may eat from …).",
      "Galley check: Missing on 27D → Use backup.",
      "Seat service 23C: code CTUS6P → red; code 7K2Q9F → green. Airplane mode off.",
    ],
    say: "On board the tablet is offline. The copilot tells the crew in Japanese what each passenger can't eat, which tray is theirs, and when someone who doesn't eat before sunrise may eat: the sun rises over the aircraft long before it rises in Delhi. A wrong tray is stopped at the seat.",
    sees: "Seats coloured by strictness, 2A's card with her sun timer, the serve list; red then green at 23C.",
    handoff: "C5",
  },
  5: {
    device: "projector",
    screen: "/ops/changes",
    steps: ["Show the metrics strip on /ops/changes.", "Open /ops/load: the reserve and the universal plate."],
    say: "Same seven events, two ways. Today: most strict needs unmet and fresh meals thrown away. With ThaliBento: every hard need met, and the safety stock is a shelf-stable pouch that flies again, so covering almost every late request costs almost nothing.",
    sees: "Hard needs met ThaliBento vs today, meals thrown away, diets known before the cutoff; the universal plate covering 13 of 13 diets.",
    handoff: null,
  },
}

/** One line on what each screen is, for the guide bar. Longest matching prefix wins. */
const SCREENS: [string, string][] = [
  ["/ops/changes", "Change control: every late change, the rung of the ladder it took, what the passenger was told, and what today's process would have done."],
  ["/ops/desk", "Change desk: check-in, lounge, gate and crew log a late need; the router answers with the best fix still possible."],
  ["/ops/load", "Smart load: the cabin's diets (told and forecast), a reserve that never goes bad, and the universal plate."],
  ["/ops/sun", "Sun at the aircraft: when passengers who eat only in daylight may eat, at the aircraft's real position."],
  ["/chat", "Priya's phone: she says her diet in her own words; the Calendar Radar and the router answer here."],
  ["/ops/alerts", "Alert: the booking lines before and after the change, the deadline, and the fix a person approves."],
  ["/ops/late", "Late requests at the gate: every meal already on board, checked against the passenger's own food rules."],
  ["/ops", "Ops console: Delhi ground staff. The watcher reads every passenger list from the booking system and raises an alert when a special meal is missing or wrong."],
  ["/caterer/labels", "Tray labels: each carries a code and the food rules, not a seat, because seats change after the truck leaves."],
  ["/caterer", "Caterer portal: the kitchen gets numbered meal lists with every change spelled out, and acknowledges each one."],
  ["/insights", "Insights: every meal promise, hand-off by hand-off: where it broke and how fast it was fixed."],
  ["/demo", "Demo control: steps the flight clock through the story and says who clicks what."],
]

export function screenHelp(path: string): string | null {
  return SCREENS.find(([prefix]) => path.startsWith(prefix))?.[1] ?? null
}
