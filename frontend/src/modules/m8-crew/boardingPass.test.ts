import { describe, expect, it } from "vitest"

import type { Passenger } from "@/lib/types"

import { dayOfYear, findByPass, parseBcbp, toBcbp } from "./boardingPass"

const FLIGHT = { flight_no: "JL740", date: "2026-10-25", origin: "DEL", dest: "NRT" }

function pax(id: string, seat: string, surname: string, given: string, pnr: string, title = "MS"): Passenger {
  return {
    id, flight_id: "JL740-20261025", seat, cabin: "Y", surname, given, title, pnr, ssr_meal: null, ssr_note: null,
    inbound: null, group: null, is_judge: false, display_name: null, profile_id: null,
  }
}

const PRIYA = pax("PX-0057", "23C", "SHARMA", "PRIYA", "6XK2QP")
const CABIN = [
  PRIYA,
  pax("PX-0043", "21D", "NAIR", "DIVYA", "Q7LM2A"),
  pax("PX-0044", "21E", "NAIR", "ARJUN", "Q7LM2A", "MR"),
]

describe("boarding pass", () => {
  it("reads the mandatory BCBP fields", () => {
    const raw = toBcbp(PRIYA, FLIGHT, 57)
    expect(raw).toBe("M1SHARMA/PRIYA MS     E6XK2QP DELNRTJL 0740 298Y023C000571" + "00")
    expect(parseBcbp(raw)).toEqual({
      surname: "SHARMA", given: "PRIYA", pnr: "6XK2QP", from: "DEL", to: "NRT", carrier: "JL", flight: "740",
      dayOfYear: 298, cabin: "Y", seat: "23C",
    })
    expect(parseBcbp("6XK2QP")).toBeNull()
    expect(dayOfYear("2026-10-25")).toBe(298)
  })

  it("finds the passenger by the pass, then by the booking reference typed from it", () => {
    expect(findByPass(CABIN, FLIGHT, toBcbp(PRIYA, FLIGHT))).toMatchObject({ kind: "found", passengers: [PRIYA], rebooked: false })
    expect(findByPass(CABIN, FLIGHT, " 6xk2qp ")).toMatchObject({ kind: "found", passengers: [PRIYA] })
    const family = findByPass(CABIN, FLIGHT, "Q7LM2A")
    expect(family.kind === "found" && family.passengers.map((p) => p.seat)).toEqual(["21D", "21E"])
    expect(findByPass(CABIN, FLIGHT, "Q7LM2A NAIR").kind).toBe("found")
  })

  it("still finds a rebooked passenger by name, and keeps the seat the pass shows", () => {
    const old = toBcbp({ ...PRIYA, pnr: "6XK2QP", seat: "24A" }, FLIGHT)
    const cabin = [{ ...PRIYA, pnr: "K9W4TZ" }, ...CABIN.slice(1)]
    const match = findByPass(cabin, FLIGHT, old)
    expect(match).toMatchObject({ kind: "found", rebooked: true })
    expect(match.kind === "found" && match.pass?.seat).toBe("24A")
  })

  it("says when the pass is for another flight or can't be read", () => {
    const home = toBcbp(PRIYA, { ...FLIGHT, flight_no: "JL749", date: "2026-11-20", origin: "NRT", dest: "DEL" })
    expect(findByPass(CABIN, FLIGHT, home).kind).toBe("other_flight")
    expect(findByPass(CABIN, FLIGHT, "hello").kind).toBe("unreadable")
    expect(findByPass(CABIN, FLIGHT, "ZZZZZZ").kind).toBe("not_found")
  })
})
