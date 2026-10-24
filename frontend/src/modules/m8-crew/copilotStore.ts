// Copilot taps (eaten, refused, swapped) go into the tablet's existing event queue, so the normal sync sends
// them when the connection is back. They are applied to the stored package here, in the same transaction,
// because the shared offline store only knows how to apply the v1 galley and scan events.
import { db } from "@/lib/offline/db"
import type { CrewEvent, StoredPackage } from "@/lib/offline/types"
import { withTap, type CopilotPackage, type CopilotTap, type TapType } from "@/modules/m8-crew/copilot"

export interface NewTap {
  type: TapType
  passenger_id: string
  seat: string
  item_id: string | null
  /** Sim time on the tablet. */
  at: string
}

// randomUUID needs a secure context; the hotspot fallback (plain http) doesn't have one.
function newClientId(): string {
  return crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/** Queue a tap and apply it to the stored package. Returns the updated package, or null before a download. */
export async function recordTap(flightId: string, tap: NewTap): Promise<StoredPackage | null> {
  const full: CopilotTap = { ...tap, client_id: newClientId() }
  // The server accepts these types (m20); the shared CrewEvent type lists only the v1 ones, and a tap may have no tray.
  const event = {
    client_id: full.client_id,
    type: tap.type,
    passenger_id: tap.passenger_id,
    seat: tap.seat,
    ...(tap.item_id ? { item_id: tap.item_id } : {}),
    at: tap.at,
    wall_at: new Date().toISOString(),
  } as unknown as CrewEvent
  return db.transaction("rw", db.packages, db.queue, async () => {
    const stored = await db.packages.get(flightId)
    if (!stored) return null
    const next: StoredPackage = { ...stored, pkg: withTap(stored.pkg as CopilotPackage, full) }
    await db.queue.put({ client_id: full.client_id, flight_id: flightId, seed_epoch: stored.pkg.seed_epoch, event })
    await db.packages.put(next)
    return next
  })
}
