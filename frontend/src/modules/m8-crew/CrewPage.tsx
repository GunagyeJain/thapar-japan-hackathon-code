// "/crew": the crew tablet. Download the flight package while online; everything below works in airplane mode.
import { CloudDownload, RefreshCw, Wifi, WifiOff } from "lucide-react"
import { useCallback, useState } from "react"

import { FLIGHT_ID } from "@/lib/api"
import { useSimClock } from "@/lib/clock"
import { fmtTime } from "@/lib/format"
import { useCrewStore } from "@/lib/offline/store"
import { Button, EmptyState, StatusChip, Tabs, TabsContent, TabsList, TabsTrigger } from "@/ui"
import { Bi } from "@/modules/m8-crew/Bi"
import { CrewSeats } from "@/modules/m8-crew/CrewSeats"
import { GalleyCheck } from "@/modules/m8-crew/GalleyCheck"
import { COPY } from "@/modules/m8-crew/i18n"
import { SeatScan } from "@/modules/m8-crew/SeatScan"

function StatusBar({ store, simNow }: { store: ReturnType<typeof useCrewStore>; simNow: Date | null }) {
  const [busy, setBusy] = useState(false)
  const ready = store.stored
  const download = async () => {
    setBusy(true)
    await store.download(simNow)
    setBusy(false)
  }
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card px-4 py-3">
      <StatusChip
        status={store.online ? "safe" : "warn"}
        icon={store.online ? Wifi : WifiOff}
        label={store.online ? `${COPY.online.ja} · ${COPY.online.en}` : `${COPY.offline.ja} · ${COPY.offline.en}`}
      />
      {ready ? (
        <StatusChip status="info" label={`${COPY.ready(fmtTime(ready.downloaded_at, "IST")).ja} · ${COPY.ready(fmtTime(ready.downloaded_at, "IST")).en}`} />
      ) : (
        <StatusChip status="warn" label={`${COPY.notReady.ja} · ${COPY.notReady.en}`} />
      )}
      <StatusChip
        status={store.pending ? "warn" : "neutral"}
        icon={RefreshCw}
        label={store.pending ? `${COPY.pending(store.pending).ja} · ${COPY.pending(store.pending).en}` : `${COPY.synced.ja} · ${COPY.synced.en}`}
      />
      {store.error && <span className="text-sm text-warn">{store.error}</span>}
      <Button size="lg" className="ml-auto h-12" variant={ready ? "outline" : "default"} disabled={!store.online || busy} onClick={() => void download()}>
        <CloudDownload />
        {ready ? `${COPY.redownload.ja} · ${COPY.redownload.en}` : `${COPY.download.ja} · ${COPY.download.en}`}
      </Button>
    </div>
  )
}

export function CrewPage() {
  const store = useCrewStore(FLIGHT_ID)
  const { now: simNow } = useSimClock()
  const [tab, setTab] = useState("galley")
  const [seat, setSeat] = useState("23C")
  const now = useCallback(() => (simNow ?? new Date()).toISOString(), [simNow])
  const pkg = store.stored?.pkg

  const goScan = (s: string) => {
    setSeat(s)
    setTab("scan")
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <Bi text={COPY.title} size="lg" />
        <span className="text-sm text-muted-foreground tabular">
          {pkg ? `${pkg.flight.flight_no} · ${pkg.flight.origin} ${fmtTime(pkg.flight.std, "IST")} → ${pkg.flight.dest} ${fmtTime(pkg.flight.sta, "JST")}` : ""}
          {simNow && ` · ${fmtTime(simNow, "JST")} / ${fmtTime(simNow, "IST")}`}
        </span>
      </div>
      <StatusBar store={store} simNow={simNow} />

      {store.loading ? (
        <div className="h-64 animate-pulse rounded-xl bg-muted" aria-busy="true" />
      ) : !pkg ? (
        <EmptyState
          icon={CloudDownload}
          title={<Bi text={COPY.notReady} />}
          body="The package holds the flight, passengers, meals and verdicts for JL740. After the download, the galley check and seat scan work in airplane mode."
        />
      ) : (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="h-14 w-full max-w-xl">
            <TabsTrigger value="galley" className="h-12 text-base">{COPY.tabGalley.ja} <span className="text-muted-foreground">{COPY.tabGalley.en}</span></TabsTrigger>
            <TabsTrigger value="scan" className="h-12 text-base">{COPY.tabScan.ja} <span className="text-muted-foreground">{COPY.tabScan.en}</span></TabsTrigger>
            <TabsTrigger value="seats" className="h-12 text-base">{COPY.tabSeats.ja} <span className="text-muted-foreground">{COPY.tabSeats.en}</span></TabsTrigger>
          </TabsList>
          <TabsContent value="galley" className="pt-3">
            <GalleyCheck pkg={pkg} now={now} record={store.record} />
          </TabsContent>
          <TabsContent value="scan" className="pt-3">
            <SeatScan pkg={pkg} seat={seat} onSeat={setSeat} now={now} record={store.record} />
          </TabsContent>
          <TabsContent value="seats" className="pt-3">
            <CrewSeats pkg={pkg} online={store.online} onSeat={goScan} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}
