// /ops/late: find the passenger, tap their food rules, find a safe meal on board, reserve it.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Search, UtensilsCrossed } from "lucide-react"
import { useState } from "react"

import { api, FLIGHT_ID, POLL_MS } from "@/lib/api"
import type { Lang, Passenger } from "@/lib/types"
import { cn } from "@/lib/utils"
import { Button, EmptyState, Input, KpiTile, LangSwitch, PageHeader, toast } from "@/ui"
import { DietPicker } from "@/modules/m3-passenger/DietPicker"
import { EMPTY_DIET, toRequest } from "@/modules/m3-passenger/diet"
import type { DietValue } from "@/modules/m3-passenger/types"
import { BackupForecast } from "@/modules/m6-matcher/BackupForecast"
import { MatchResult } from "@/modules/m6-matcher/MatchResult"
import type { InventoryResponse, LateRequestResponse, MatchResult as Result } from "@/modules/m6-matcher/types"

const MAX_HITS = 6

function useInventory() {
  return useQuery({
    queryKey: ["m6", "inventory", FLIGHT_ID],
    queryFn: () => api.get<InventoryResponse>(`/flights/${FLIGHT_ID}/inventory`),
    refetchInterval: POLL_MS,
  })
}

function InventoryStrip() {
  const inv = useInventory()
  if (inv.isError) return <p className="text-sm text-unsafe">Couldn't load the galley inventory: {inv.error.message}</p>
  const s = inv.data?.summary
  if (!s) return <div className="h-28 animate-pulse rounded-xl bg-ice" aria-busy="true" />
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <KpiTile label="Free for late requests" value={s.free} />
      <KpiTile label="Spare special meals" value={s.spare} />
      <KpiTile label="Main-menu meals free" value={s.main_free.C + s.main_free.Y} delta={`C ${s.main_free.C} · Y ${s.main_free.Y}`} />
      <KpiTile label="Sealed backups" value={s.backup - s.backup_reserve} delta={`+${s.backup_reserve} held for the galley`} />
    </div>
  )
}

function PassengerSearch({ selected, onSelect }: { selected: Passenger | null; onSelect: (p: Passenger) => void }) {
  const [query, setQuery] = useState("")
  const passengers = useQuery({
    queryKey: ["flight", FLIGHT_ID, "passengers"],
    queryFn: () => api.get<Passenger[]>(`/flights/${FLIGHT_ID}/passengers`),
  })
  const q = query.trim().toUpperCase()
  const hits = q
    ? (passengers.data ?? []).filter((p) => p.seat === q || p.pnr === q || p.surname.startsWith(q)).slice(0, MAX_HITS)
    : []
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="pax-search" className="text-sm font-medium text-muted-foreground">
        Passenger (seat, PNR or surname)
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute top-2.5 left-3 size-4 text-muted-foreground" aria-hidden="true" />
        <Input id="pax-search" className="pl-9" value={query} maxLength={20} onChange={(e) => setQuery(e.target.value)} />
      </div>
      {passengers.isError && <p className="text-sm text-unsafe">Couldn't load passengers: {passengers.error.message}</p>}
      {hits.length > 0 && (
        <ul className="flex flex-col rounded-lg border">
          {hits.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => {
                  onSelect(p)
                  setQuery("")
                }}
                className="flex w-full items-center gap-3 border-t px-3 py-2 text-left text-sm first:border-t-0 hover:bg-ice focus-visible:bg-ice focus-visible:outline-none"
              >
                <span className="w-10 font-semibold tabular">{p.seat}</span>
                <span className="flex-1">
                  {p.surname}/{p.given} {p.title}
                </span>
                <span className="code text-muted-foreground">{p.pnr}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {selected && (
        <div className="flex flex-wrap items-baseline gap-x-3 rounded-lg bg-ice px-3 py-2 text-sm">
          <span className="font-display text-lg font-semibold tabular">{selected.seat}</span>
          <span className="font-medium">
            {selected.surname}/{selected.given} {selected.title}
          </span>
          <span className="code text-muted-foreground">{selected.pnr}</span>
          <span className="text-muted-foreground">
            {selected.cabin === "C" ? "Business" : "Economy"} · {selected.ssr_meal ? `booked ${selected.ssr_meal}` : "no special meal booked"}
          </span>
        </div>
      )}
    </div>
  )
}

export function LateDesk() {
  const queryClient = useQueryClient()
  const [lang, setLang] = useState<Lang>("en")
  const [passenger, setPassenger] = useState<Passenger | null>(null)
  const [diet, setDiet] = useState<DietValue>(EMPTY_DIET)
  const [result, setResult] = useState<{ match: Result; reservedId?: string } | null>(null)

  // Allergies go in as forbidden too, the same way the passenger and judge forms send them.
  const { forbid, allow } = toRequest(diet)
  const body = () => ({ flight_id: FLIGHT_ID, passenger_id: passenger?.id, forbid, allow, source: "gate" })
  const find = useMutation({
    mutationFn: () => api.post<Result>("/match", body()),
    onSuccess: (match) => setResult({ match }),
    onError: (e) => toast.error(`Couldn't check the meals: ${e.message}`),
  })
  const reserve = useMutation({
    mutationFn: () => api.post<LateRequestResponse>("/late-requests", body()),
    onSuccess: (res) => {
      setResult({ match: res.match, reservedId: res.late_request.id })
      queryClient.invalidateQueries({ queryKey: ["m6", "inventory"] })
      toast.success(
        res.match.item
          ? `${passenger?.seat}: ${res.match.item.id} reserved. Crew and passenger told.`
          : `${passenger?.seat}: voucher ${res.match.voucher?.code} issued.`,
      )
    },
    onError: (e) => toast.error(`Couldn't reserve: ${e.message}`),
  })
  const ready = passenger !== null && forbid.length > 0
  const choose = (p: Passenger) => {
    setPassenger(p)
    setResult(null)
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
      <PageHeader
        eyebrow="Gate and check-in desk"
        title="Late requests"
        subtitle="A safe meal from what's on board"
        actions={<LangSwitch value={lang} onChange={setLang} />}
      />
      <InventoryStrip />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <section className="flex flex-col gap-5 rounded-xl border bg-card p-5" aria-label="Request">
          <PassengerSearch selected={passenger} onSelect={choose} />
          <DietPicker
            compact
            value={diet}
            lang={lang}
            onChange={(d) => {
              setDiet(d)
              setResult(null)
            }}
          />
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" disabled={!ready || find.isPending} onClick={() => find.mutate()}>
              <Search /> Find a safe meal
            </Button>
            <Button disabled={!ready || !result || Boolean(result.reservedId) || reserve.isPending} onClick={() => reserve.mutate()}>
              <UtensilsCrossed /> {result?.match.status === "voucher" ? "Issue voucher" : "Reserve"}
            </Button>
          </div>
          {result?.reservedId && (
            <p className="text-sm text-safe">
              Done: late request <span className="code">{result.reservedId}</span>. Crew see it at boarding.
            </p>
          )}
        </section>
        <section className={cn("rounded-xl border bg-card p-5", !result && "flex")} aria-label="Result" aria-live="polite">
          {result ? (
            <MatchResult result={result.match} lang={lang} />
          ) : (
            <EmptyState
              className="flex-1"
              title="Every meal on board, checked against their rules"
              body="Pick a passenger and their food rules."
            />
          )}
        </section>
      </div>
      <BackupForecast lang={lang} />
    </div>
  )
}
