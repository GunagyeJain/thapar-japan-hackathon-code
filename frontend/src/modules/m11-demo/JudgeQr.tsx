// Invite the judges: a QR for this page's own address + "/j", and how many have joined.
import { useQuery } from "@tanstack/react-query"
import { Users } from "lucide-react"
import { encode } from "uqr"

import { api, FLIGHT_ID, POLL_MS } from "@/lib/api"
import type { Passenger } from "@/lib/types"

function QrSvg({ text }: { text: string }) {
  const { data, size } = encode(text, { border: 2 })
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="aspect-square w-full max-w-56 rounded-md bg-white" role="img" aria-label={`QR code for ${text}`}>
      {data.flatMap((row, y) => row.map((on, x) => (on ? <rect key={`${x}-${y}`} x={x} y={y} width={1.02} height={1.02} fill="var(--navy)" /> : null)))}
    </svg>
  )
}

export function JudgeQr() {
  const joinUrl = `${window.location.origin}/j`
  const judges = useQuery({
    queryKey: ["flight", FLIGHT_ID, "passengers"],
    queryFn: () => api.get<Passenger[]>(`/flights/${FLIGHT_ID}/passengers`),
    refetchInterval: POLL_MS,
    select: (rows) => rows.filter((p) => p.is_judge),
  })
  const joined = judges.data ?? []
  return (
    <section className="flex flex-col items-center gap-3 rounded-xl border bg-card p-5 text-center" aria-labelledby="judge-qr">
      <h2 id="judge-qr" className="text-base font-semibold">
        Judges: join JL740
      </h2>
      <QrSvg text={joinUrl} />
      <p className="code text-sm break-all">{joinUrl}</p>
      <p className="flex items-center gap-2 text-sm tabular">
        <Users className="size-4 text-muted-foreground" aria-hidden="true" />
        {judges.isError ? "Couldn't count judges" : `${joined.length} joined`}
        {joined.length > 0 && (
          <span className="text-muted-foreground">
            · {joined.map((j) => `${j.seat} ${j.display_name ?? j.given}`).join(", ")}
          </span>
        )}
      </p>
    </section>
  )
}
