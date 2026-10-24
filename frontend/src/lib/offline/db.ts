// IndexedDB for the crew tablet: the flight package and the queue of events waiting to sync.
import { Dexie, type EntityTable } from "dexie"

import type { QueuedEvent, StoredPackage } from "@/lib/offline/types"

export const db = new Dexie("thalibento-crew") as Dexie & {
  packages: EntityTable<StoredPackage, "flight_id">
  queue: EntityTable<QueuedEvent, "client_id">
}

db.version(1).stores({
  packages: "flight_id",
  queue: "client_id, flight_id",
})
