// The crew tablet's offline store: download the package, queue events, sync when the network is back.
import { useCallback, useEffect, useState } from "react"

import { api } from "@/lib/api"
import { applyLocal } from "@/lib/offline/apply"
import { db } from "@/lib/offline/db"
import type { CrewEvent, CrewPackage, QueuedEvent, StoredPackage } from "@/lib/offline/types"

const SYNC_EVERY_MS = 5000

// randomUUID needs a secure context; the hotspot fallback (plain http) doesn't have one.
function newClientId(): string {
  return crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export interface SyncResult {
  accepted: number
  duplicates: number
  ignored_old_epoch: number
}

export async function downloadPackage(flightId: string, simNow: Date | null): Promise<StoredPackage> {
  const pkg = await api.get<CrewPackage>(`/flights/${flightId}/crew-package`)
  const stored: StoredPackage = { flight_id: flightId, pkg, downloaded_at: (simNow ?? new Date(pkg.generated_at)).toISOString() }
  await db.packages.put(stored)
  return stored
}

// Local writes run one at a time: two quick taps must not both start from the same package.
let writes: Promise<unknown> = Promise.resolve()

/** Queue an event and apply it to the local package. Returns the updated package. */
export function recordEvent(flightId: string, event: Omit<CrewEvent, "client_id">): Promise<StoredPackage | null> {
  const run = writes.then(() => writeEvent(flightId, event))
  writes = run.catch(() => undefined)
  return run
}

async function writeEvent(flightId: string, event: Omit<CrewEvent, "client_id">): Promise<StoredPackage | null> {
  const stored = await db.packages.get(flightId)
  if (!stored) return null
  const full: CrewEvent = { ...event, client_id: newClientId() }
  const next: StoredPackage = { ...stored, pkg: applyLocal(stored.pkg, full) }
  await db.transaction("rw", db.packages, db.queue, async () => {
    await db.queue.put({ client_id: full.client_id, flight_id: flightId, seed_epoch: stored.pkg.seed_epoch, event: full })
    await db.packages.put(next)
  })
  return next
}

/** Send queued events, one batch per seed epoch. Synced (or old-epoch) events leave the queue. */
export async function syncQueue(flightId: string): Promise<SyncResult | null> {
  const pending = await db.queue.where("flight_id").equals(flightId).toArray()
  if (pending.length === 0) return null
  const byEpoch = new Map<number, QueuedEvent[]>()
  for (const q of pending) byEpoch.set(q.seed_epoch, [...(byEpoch.get(q.seed_epoch) ?? []), q])
  const total: SyncResult = { accepted: 0, duplicates: 0, ignored_old_epoch: 0 }
  for (const [epoch, batch] of byEpoch) {
    const r = await api.post<SyncResult>(`/flights/${flightId}/crew-events`, {
      seed_epoch: epoch,
      events: batch.map((q) => q.event),
    })
    total.accepted += r.accepted
    total.duplicates += r.duplicates
    total.ignored_old_epoch += r.ignored_old_epoch
    await db.queue.bulkDelete(batch.map((q) => q.client_id))
  }
  return total
}

function useOnline(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine)
  useEffect(() => {
    const up = () => setOnline(true)
    const down = () => setOnline(false)
    window.addEventListener("online", up)
    window.addEventListener("offline", down)
    return () => {
      window.removeEventListener("online", up)
      window.removeEventListener("offline", down)
    }
  }, [])
  return online
}

export interface CrewStore {
  stored: StoredPackage | null
  loading: boolean
  online: boolean
  pending: number
  lastSync: SyncResult | null
  error: string | null
  download: (simNow: Date | null) => Promise<void>
  record: (event: Omit<CrewEvent, "client_id">) => Promise<void>
  syncNow: () => Promise<void>
}

export function useCrewStore(flightId: string): CrewStore {
  const online = useOnline()
  const [stored, setStored] = useState<StoredPackage | null>(null)
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState(0)
  const [lastSync, setLastSync] = useState<SyncResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refreshPending = useCallback(async () => {
    setPending(await db.queue.where("flight_id").equals(flightId).count())
  }, [flightId])

  useEffect(() => {
    let alive = true
    db.packages
      .get(flightId)
      .then((s) => alive && setStored(s ?? null))
      .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : "Couldn't open the tablet's storage"))
      .finally(() => alive && setLoading(false))
    void refreshPending()
    return () => {
      alive = false
    }
  }, [flightId, refreshPending])

  const syncNow = useCallback(async () => {
    try {
      const r = await syncQueue(flightId)
      if (r) setLastSync(r)
      setError(null)
    } catch (e: unknown) {
      // Offline or server down: events stay queued and go out on the next try.
      if (navigator.onLine) setError(e instanceof Error ? e.message : "Sync failed")
    } finally {
      await refreshPending()
    }
  }, [flightId, refreshPending])

  useEffect(() => {
    if (!online) return
    void syncNow()
    const id = window.setInterval(() => void syncNow(), SYNC_EVERY_MS)
    return () => window.clearInterval(id)
  }, [online, syncNow])

  const download = useCallback(
    async (simNow: Date | null) => {
      try {
        await syncNow() // send anything queued first, so the new package includes it
        setStored(await downloadPackage(flightId, simNow))
        setError(null)
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Download failed")
      }
    },
    [flightId, syncNow],
  )

  const record = useCallback(
    async (event: Omit<CrewEvent, "client_id">) => {
      const next = await recordEvent(flightId, event)
      if (next) setStored(next)
      await refreshPending()
      if (navigator.onLine) void syncNow()
    },
    [flightId, refreshPending, syncNow],
  )

  return { stored, loading, online, pending, lastSync, error, download, record, syncNow }
}
