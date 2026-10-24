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
    steps: ["Press Start: reset to 23 Oct 18:00.", "Leave the judge QR on screen while the judges join."],
    say: "Priya flies JL740 from Delhi to Tokyo tomorrow morning. She's vegetarian and doesn't eat onion or garlic. Judges: scan the QR and join the flight, and tell it what you can't eat.",
    sees: "The boarding pass, the QR, and \"N joined\" ticking up as judges get seats in row 5.",
    handoff: null,
  },
  1: {
    device: "phone",
    screen: "/p",
    steps: [
      "PNR 6XK2QP, surname SHARMA → Find booking.",
      "Next → Continue (consent).",
      "Tap Vegetarian, tick Onion & garlic → Next → Yes, that's right.",
      "Confirm AVML. Then open /ops on the projector.",
    ],
    say: "She doesn't pick a meal code. She says what she can't eat; the rules pick AVML and add the kitchen note. On the ops board, an agent booked 24A on HNML, a non-vegetarian Hindu meal, for a vegetarian, so it's flagged with the fix.",
    sees: "AVML recommended with NO ONION NO GARLIC; her tray label; on /ops the 24A wrong-code alert.",
    handoff: "C1",
  },
  2: {
    device: "projector",
    screen: "/ops",
    steps: ["On /ops, click the alert \"Meal request dropped after rebooking\" (23C)."],
    say: "Late at night her IndiGo connection is rebooked. The new booking reaches JAL without her meal. Today nobody would notice until the seat. We catch it with 1 hour 38 minutes left before the caterer's final list.",
    sees: "The countdown to the caterer's list, and the booking lines before and after: the AVML line is gone.",
    handoff: "C2",
  },
  3: {
    device: "projector",
    screen: "/ops",
    steps: ["On the alert, press Request again.", "Check the SSR line, then press Approve and send.", "Hold up Priya's phone: \"Your meal is restored\"."],
    say: "Staff see the exact line that goes back to the booking. A person approves it; nothing changes on its own.",
    sees: "The SSR line .R/AVML HK1 NO ONION NO GARLIC; the alert turns Resolved; Priya's phone says her meal is restored.",
    handoff: "C2",
  },
  4: {
    device: "projector",
    screen: "/caterer",
    steps: ["On /caterer, press Acknowledge on list v3.", "Press Labels to show the tray labels."],
    say: "The kitchen gets numbered meal lists with every change spelled out, and acknowledges them. Labels carry a code, not a seat: seats change after the truck leaves.",
    sees: "List v3 with the change 6XK2QP → 8MZ2TN, then Acknowledged 00:40, then the label sheet.",
    handoff: "C3",
  },
  5: {
    device: "projector",
    screen: "/ops/late",
    steps: ["Type 31K and pick 31K MEHTA.", "Tap Jain → Find a safe meal.", "Press Reserve."],
    say: "At the gate, Mr Mehta asks for a Jain meal he never booked. We check every meal already on board against his rules and explain why each one fails.",
    sees: "A spare Jain meal in galley 2 is safe; every other meal shows why not (contains onion, garlic…).",
    handoff: "LATE",
  },
  6: {
    device: "ipad",
    screen: "/crew",
    steps: ["On the iPad, press Download for flight.", "Turn on airplane mode."],
    say: "At boarding the crew download the flight once. From here the tablet is offline.",
    sees: "\"Saved 03:35\", then the tablet shows Offline.",
    handoff: "C4",
  },
  7: {
    device: "ipad",
    screen: "/crew",
    steps: [
      "1 · Galley check: Found on each tray, Missing on 27D → Use backup.",
      "2 · Seat service: seat 23C, code CTUS6P → Check: red. Next.",
      "Seat 23C, code 7K2Q9F (or scan Priya's label) → Check: green. Next.",
      "Turn airplane mode off: the scans sync.",
    ],
    say: "27D's tray didn't make it on board; the tablet offers the sealed backup. At the seat, the wrong tray is stopped before it's served, offline, with the same rules as the server.",
    sees: "7 of 8 found → backup used; red \"Do not serve · contains onion, garlic\"; green \"Safe to serve\".",
    handoff: "C5",
  },
  8: {
    device: "projector",
    screen: "/insights",
    steps: ["Open /insights and pick 23C."],
    say: "Landed in Tokyo. Priya's meal promise held at all five hand-offs. It broke once, at 23:02, and was fixed in 7 minutes. That record is the data JAL doesn't have today.",
    sees: "5/5 checkpoints, caught 1 h 38 m before the caterer's list, fixed in 7 min, and her journey C1 → C5.",
    handoff: null,
  },
}

/** One line on what each screen is, for the guide bar. Longest matching prefix wins. */
const SCREENS: [string, string][] = [
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
