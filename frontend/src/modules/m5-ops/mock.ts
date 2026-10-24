// Stand-in for m4's alert and feed endpoints until they're on main. Exact Alert / RawMessage shapes from
// shared/README.md; the message lines are m4's own fixtures (shared/seed/messages on bhavyam/m4-watcher).
// data.ts switches to the real API by itself as soon as GET /api/alerts answers.
import type { Alert, RawMessage } from "@/lib/types"

const FLIGHT = "JL740-20261025"

const PNL_23C = `PNL
JL740/25OCT DEL PART1
CFG/030C176Y
-NRT162Y
1SHARMA/PRIYAMS .L/6XK2QP
.R/AVML HK1 NO ONION NO GARLIC
.R/SEAT HK1 23C
.I/6E5318Y24BOMDEL
ENDPNL`

const ADL_REBOOK = `ADL
JL740/25OCT DEL PART1
-NRT162Y
DEL
1SHARMA/PRIYAMS .L/6XK2QP
ADD
1SHARMA/PRIYAMS .L/8MZ2TN
.R/SEAT HK1 23C
.I/6E5102Y24BOMDEL
ENDADL`

const ADL_RESTORE = `ADL
JL740/25OCT DEL PART1
-NRT162Y
CHG
1SHARMA/PRIYAMS .L/8MZ2TN
.R/AVML HK1 NO ONION NO GARLIC
ENDADL`

export const MOCK_MESSAGES: RawMessage[] = [
  { id: "MSG-PNL-1", flight_id: FLIGHT, kind: "PNL", seq: 1, received_at: "2026-10-24T03:35:00+05:30", text: PNL_23C },
  { id: "MSG-ADL-7", flight_id: FLIGHT, kind: "ADL", seq: 7, received_at: "2026-10-24T23:02:00+05:30", text: ADL_REBOOK },
]

export const MOCK_RESTORE: RawMessage = {
  id: "MSG-ADL-8", flight_id: FLIGHT, kind: "ADL", seq: 8, received_at: "2026-10-24T23:10:00+05:30", text: ADL_RESTORE,
}

export const MOCK_ALERTS: Alert[] = [
  {
    id: "AL-MOCK-LOST",
    flight_id: FLIGHT,
    type: "LOST_MEAL",
    severity: "critical",
    passenger_id: "PX-0057",
    promise_id: null,
    title: "Meal request dropped after rebooking",
    body: "23C SHARMA/PRIYA MS: AVML NO ONION NO GARLIC was on 6XK2QP; the new booking 8MZ2TN has no meal request.",
    evidence: {
      message_ids: ["MSG-PNL-1", "MSG-ADL-7"],
      line_before: ".R/AVML HK1 NO ONION NO GARLIC",
      line_after: null,
      old_pnr: "6XK2QP",
      new_pnr: "8MZ2TN",
      inbound_before: { flight: "6E5318", from: "BOM", date: "2026-10-24" },
      inbound_after: { flight: "6E5102", from: "BOM", date: "2026-10-24" },
      ssr_draft: ".R/AVML HK1 NO ONION NO GARLIC",
    },
    deadline_at: "2026-10-25T00:40:00+05:30",
    status: "open",
    created_at: "2026-10-24T23:02:00+05:30",
    actions: [],
  },
  {
    id: "AL-MOCK-WRONG",
    flight_id: FLIGHT,
    type: "WRONG_CODE",
    severity: "warning",
    passenger_id: "PX-0063",
    promise_id: "MP-0063",
    title: "24A VERMA: booked HNML, needs AVML",
    body: "HNML contains chicken, mutton, fish, which this passenger does not eat.",
    evidence: { booked_code: "HNML", contains: ["chicken", "mutton", "fish"], suggested_code: "AVML" },
    deadline_at: "2026-10-25T00:40:00+05:30",
    status: "open",
    created_at: "2026-10-23T18:10:00+05:30",
    actions: [],
  },
]
