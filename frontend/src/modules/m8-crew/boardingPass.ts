// Seat service by boarding pass: the IATA bar-coded boarding pass (BCBP, Resolution 792) on paper or on the
// passenger's phone, or the booking reference typed from it. Everything is matched in the offline package.
import type { Passenger } from "@/lib/types"

export interface BoardingPass {
  surname: string
  given: string
  pnr: string
  from: string
  to: string
  carrier: string
  /** Flight number without leading zeros: "740". */
  flight: string
  /** Day of the year the flight leaves (BCBP carries no year). */
  dayOfYear: number
  cabin: string
  /** "23C" */
  seat: string
}

export type PassMatch =
  | { kind: "found"; passengers: Passenger[]; pass: BoardingPass | null; rebooked: boolean }
  | { kind: "other_flight"; pass: BoardingPass }
  | { kind: "not_found"; pass: BoardingPass | null }
  | { kind: "unreadable" }

const TITLES = new Set(["MR", "MRS", "MS", "MISS", "MSTR", "DR", "PROF"])
/** The mandatory first-leg fields end at column 58 (passenger status). */
const BCBP_MIN_LENGTH = 58
const BOOKING_REF = /^[A-Z0-9]{6}$/

/** The mandatory first-leg fields of a BCBP string, e.g. "M1SHARMA/PRIYA MS     E6XK2QP DELNRTJL 0740 298Y023C00057100". */
export function parseBcbp(raw: string): BoardingPass | null {
  const s = raw.replace(/[\r\n]/g, "").toUpperCase()
  if (!/^M[1-4]/.test(s) || s.length < BCBP_MIN_LENGTH) return null
  const [surname = "", rest = ""] = s.slice(2, 22).trim().split("/")
  const words = rest.trim().split(/\s+/).filter(Boolean)
  const given = (TITLES.has(words[words.length - 1] ?? "") ? words.slice(0, -1) : words).join(" ")
  const dayOfYear = Number(s.slice(44, 47))
  if (!surname || !Number.isInteger(dayOfYear)) return null
  return {
    surname: surname.trim(),
    given,
    pnr: s.slice(23, 30).trim(),
    from: s.slice(30, 33),
    to: s.slice(33, 36),
    carrier: s.slice(36, 39).trim(),
    flight: s.slice(39, 44).trim().replace(/^0+/, ""),
    dayOfYear,
    cabin: s.slice(47, 48),
    seat: s.slice(48, 52).trim().replace(/^0+/, ""),
  }
}

/** Day of the year (1–366) of an ISO date, read as written. */
export function dayOfYear(isoDate: string): number {
  const [y, m, d] = isoDate.slice(0, 10).split("-").map(Number)
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 1)) / 86_400_000) + 1
}

/** "JL740" → {carrier: "JL", flight: "740"} */
function splitFlightNo(flightNo: string): { carrier: string; flight: string } {
  const m = /^([A-Z0-9]{2})0*(\d+[A-Z]?)$/.exec(flightNo.toUpperCase())
  return m ? { carrier: m[1], flight: m[2] } : { carrier: "", flight: flightNo }
}

function sameName(p: Passenger, pass: BoardingPass): boolean {
  const given = p.given.toUpperCase()
  return p.surname.toUpperCase() === pass.surname && (!pass.given || given.startsWith(pass.given) || pass.given.startsWith(given))
}

/**
 * Who this boarding pass (or booking reference) belongs to on this flight. A BCBP is matched on booking reference
 * and name; if the reference changed since the pass was printed (a rebooking), on the name alone.
 */
export function findByPass(passengers: Passenger[], flight: { flight_no: string; date: string }, raw: string): PassMatch {
  const text = raw.trim().toUpperCase()
  if (!text) return { kind: "unreadable" }
  const pass = parseBcbp(text)
  if (pass) {
    const ours = splitFlightNo(flight.flight_no)
    if (pass.carrier !== ours.carrier || pass.flight !== ours.flight || pass.dayOfYear !== dayOfYear(flight.date)) {
      return { kind: "other_flight", pass }
    }
    const byRef = passengers.filter((p) => p.pnr.toUpperCase() === pass.pnr && sameName(p, pass))
    if (byRef.length) return { kind: "found", passengers: byRef, pass, rebooked: false }
    const byName = passengers.filter((p) => sameName(p, pass))
    return byName.length === 1 ? { kind: "found", passengers: byName, pass, rebooked: true } : { kind: "not_found", pass }
  }
  const [ref, surname] = text.split(/\s+/)
  if (!BOOKING_REF.test(ref)) return { kind: "unreadable" }
  const hits = passengers.filter((p) => p.pnr.toUpperCase() === ref && (!surname || p.surname.toUpperCase() === surname))
  return hits.length ? { kind: "found", passengers: hits, pass: null, rebooked: false } : { kind: "not_found", pass: null }
}

/** A BCBP string for a passenger on a flight: what a mobile boarding pass would carry (for the seat screens and tests). */
export function toBcbp(p: Pick<Passenger, "surname" | "given" | "title" | "pnr" | "seat" | "cabin">, flight: { flight_no: string; date: string; origin: string; dest: string }, sequence = 1): string {
  const { carrier, flight: number } = splitFlightNo(flight.flight_no)
  const name = `${p.surname}/${p.given} ${p.title}`.toUpperCase().slice(0, 20).padEnd(20)
  const seatRow = /^(\d+)([A-Z])$/.exec(p.seat)
  const seat = seatRow ? `${seatRow[1].padStart(3, "0")}${seatRow[2]}` : p.seat.padStart(4, "0")
  return [
    "M1", name, "E", p.pnr.padEnd(7), flight.origin, flight.dest, carrier.padEnd(3), number.padStart(4, "0").padEnd(5),
    String(dayOfYear(flight.date)).padStart(3, "0"), p.cabin, seat, String(sequence).padStart(5, "0"), "1", "00",
  ].join("")
}
