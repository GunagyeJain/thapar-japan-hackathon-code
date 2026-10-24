// Real JL740 examples for the gallery (from shared/seed and the demo story).
import type { CheckpointEvent, Fired } from "@/lib/types"

export const PRIYA_AVML_SPARE: Fired[] = [
  {
    rule_id: "no_onion_garlic.onion",
    tag: "onion",
    via: "Vegetable biryani → onion → allium",
    message: { en: "Contains onion · 23C eats no onion or garlic", ja: "玉ねぎを含む · 23Cは玉ねぎ・にんにく不可", hi: "प्याज़ है · 23C प्याज़-लहसुन नहीं खाते" },
  },
  {
    rule_id: "no_onion_garlic.garlic",
    tag: "garlic",
    via: "Vegetable biryani → garlic → allium",
    message: { en: "Contains garlic · 23C eats no onion or garlic", ja: "にんにくを含む · 23Cは玉ねぎ・にんにく不可", hi: "लहसुन है · 23C प्याज़-लहसुन नहीं खाते" },
  },
]

export const DASHI_CHECK: Fired[] = [
  {
    rule_id: "vegetarian.fish",
    tag: "bonito",
    via: "出汁 → bonito → fish",
    message: { en: "Dashi may be made with bonito · confirm with the kitchen", ja: "出汁に鰹節の可能性 · 厨房に確認" },
  },
]

// Priya's promise through the story (Acts 1-5), as m10 will show it.
const base = { promise_id: "MP-0057", passenger_id: "PX-0057", flight_id: "JL740-20261025", data: {}, key: null }
export const PRIYA_TIMELINE: CheckpointEvent[] = [
  { ...base, id: "CE-EX1", checkpoint: "C1", result: "ok", at: "2026-10-23T18:10:00+05:30", source: "passenger_app", detail: "Profile saved: no meat, fish, egg, onion, garlic → AVML, note NO ONION NO GARLIC" },
  { ...base, id: "CE-EX2", checkpoint: "C2", result: "fail", at: "2026-10-24T23:02:00+05:30", source: "ADL 2 · 23:02", detail: "Codeshare rebooking 6E5318 → 6E5102 dropped the AVML" },
  { ...base, id: "CE-EX3", checkpoint: "C2", result: "fixed", at: "2026-10-24T23:09:00+05:30", source: "ADL 3 · 23:09", detail: "Request again approved by ops; AVML NO ONION NO GARLIC restored" },
  { ...base, id: "CE-EX4", checkpoint: "C3", result: "ok", at: "2026-10-25T00:40:00+05:30", source: "Meal list v3", detail: "Skyline Flight Kitchens acknowledged v3 (+1 AVML)" },
  { ...base, id: "CE-EX5", checkpoint: "C4", result: "ok", at: "2026-10-25T05:05:00+05:30", source: "crew tablet · offline", detail: "Tray TB-7K2Q9F found in galley 1" },
  { ...base, id: "CE-EX6", checkpoint: "C5", result: "ok", at: "2026-10-25T05:20:00+05:30", source: "crew tablet · seat scan", detail: "23C scanned green" },
]
export const PRIYA_TIMELINE_BREAK = { checkpoint: "C2", at: "2026-10-24T23:02:00+05:30", detail: "Codeshare rebooking" }

export const PRIYA_PNL = `-NRT156Y
1SHARMA/PRIYAMS .L/6XK2QP
.R/AVML HK1 NO ONION NO GARLIC
.R/SEAT HK1 23C
.I/6E5318Y24BOMDEL`

export const PRIYA_ADL = `ADL
JL740/25OCT DEL PART1
-NRT156Y
DEL
1SHARMA/PRIYAMS .L/6XK2QP
ADD
1SHARMA/PRIYAMS .L/8MZ2TN
.R/SEAT HK1 23C
.I/6E5102Y24BOMDEL
ENDADL`
