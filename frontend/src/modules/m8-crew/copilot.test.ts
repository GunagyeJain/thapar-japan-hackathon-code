import { describe, expect, it } from "vitest"

import type { MealItem, MealSpec } from "@/lib/types"
import { lastTaps, needsScan, serveProgress, serveRows, trayFor, withTap, type CopilotPackage, type CopilotSeat } from "@/modules/m8-crew/copilot"

const item = (id: string, kind: MealItem["kind"], galley: MealItem["galley"], pid: string | null, status: MealItem["status"] = "planned"): MealItem => ({
  id,
  flight_id: "JL740-20261025",
  spec_id: kind === "backup" ? "SPEC-BACKUP" : "SPEC-VJML",
  kind,
  galley,
  position: `${galley}-${id.slice(-2)}`,
  assigned_passenger_id: pid,
  status,
})

const seat = (s: string, pid: string, galley: "G1" | "G2", itemId: string | null, extra: Partial<CopilotSeat> = {}): CopilotSeat => ({
  seat: s,
  passenger_id: pid,
  tier: "hard",
  flex: false,
  card: { ja: "ベジ", en: "VEG", hi: "शाकाहारी" },
  may_eat_from: null,
  sunrise_box: false,
  assigned: itemId ? { item_id: itemId, spec_id: "SPEC-VJML", spec_name: { en: "Jain meal", ja: "ジャイナ食" }, rung: "ssr_change" } : null,
  any_main: false,
  galley,
  ...extra,
})

const spec = (id: string): MealSpec => ({ id, name: { en: id }, code: null, kind: "special", tags: [], certified: false, source: "caterer" })

function pkg(items: MealItem[], seats: CopilotSeat[], order: string[]): CopilotPackage {
  return {
    items,
    specs: [spec("SPEC-VJML"), spec("SPEC-BACKUP")],
    copilot: { seats, serve_order: order, taps: [] },
  } as unknown as CopilotPackage
}

describe("copilot serve list", () => {
  const base = pkg(
    [item("TB-AAAA01", "special", "G1", "PX-1", "served"), item("TB-AAAA02", "special", "G1", "PX-2"), item("TB-BBBB01", "backup", "G2", null)],
    [seat("2A", "PX-1", "G1", "TB-AAAA01"), seat("27D", "PX-2", "G1", "TB-AAAA02"), seat("31A", "PX-3", "G2", null, { needs_tray: true })],
    ["2A", "27D", "31A"],
  )

  it("groups seats by galley in service order and marks served trays done", () => {
    const groups = serveRows(base)
    expect([...groups.keys()]).toEqual(["G1", "G2"])
    expect(groups.get("G1")?.map((r) => [r.seat.seat, r.done])).toEqual([["2A", true], ["27D", false]])
    expect(serveProgress(base)).toEqual({ done: 1, of: 3 })
  })

  it("counts an eaten tap as done and keeps the newest tap per passenger", () => {
    const tapped = withTap(withTap(base, { client_id: "c1", type: "refused", passenger_id: "PX-2", seat: "27D", item_id: null, at: "2026-10-25T06:00:00+05:30" }), {
      client_id: "c2", type: "eaten", passenger_id: "PX-2", seat: "27D", item_id: "TB-AAAA02", at: "2026-10-25T06:05:00+05:30",
    })
    expect(lastTaps(tapped.copilot!).get("PX-2")?.type).toBe("eaten")
    expect(serveProgress(tapped)).toEqual({ done: 2, of: 3 })
    expect(withTap(tapped, tapped.copilot!.taps[0]).copilot!.taps).toHaveLength(2) // same client id: applied once
  })

  it("follows a swap made in the galley check: the backup replaces the missing tray", () => {
    const swapped = {
      ...base,
      items: base.items.map((i) =>
        i.id === "TB-AAAA02" ? { ...i, status: "missing" as const } : i.id === "TB-BBBB01" ? { ...i, assigned_passenger_id: "PX-2", status: "loaded" as const } : i,
      ),
    }
    const now = trayFor(swapped, base.copilot!.seats[1])
    expect(now.item?.id).toBe("TB-BBBB01")
    expect(now.tray?.rung).toBe("reserve_pouch")
    expect(serveRows(swapped).get("G2")?.map((r) => r.seat.seat)).toEqual(["27D", "31A"])
  })

  it("asks for a scan before a special tray is handed over, never for a main", () => {
    expect(needsScan(item("TB-X", "special", "G1", "PX-1"))).toBe(true)
    expect(needsScan(item("TB-X", "special", "G1", "PX-1", "served"))).toBe(false)
    expect(needsScan(item("TB-M", "main", "G1", null))).toBe(false)
    expect(needsScan(undefined)).toBe(false)
  })
})
