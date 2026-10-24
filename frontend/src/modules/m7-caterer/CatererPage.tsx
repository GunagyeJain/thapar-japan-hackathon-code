// /caterer: every meal list as a numbered, hashed version with its diff; the kitchen acknowledges it (C3).
import { Inbox, RefreshCw } from "lucide-react"
import { useState } from "react"

import { fmtTime } from "@/lib/format"
import { Button, EmptyState, PageHeader } from "@/ui"
import { BackupForecast } from "@/modules/m6-matcher/BackupForecast"
import { useCatererInbox, useMealLists } from "@/modules/m7-caterer/data"
import { VersionDetail } from "@/modules/m7-caterer/VersionDetail"
import { VersionList } from "@/modules/m7-caterer/VersionList"

function CatererInbox() {
  const inbox = useCatererInbox()
  const notes = inbox.data ?? []
  return (
    <section className="flex flex-col gap-2 rounded-xl border bg-card p-4" aria-labelledby="caterer-inbox">
      <h2 id="caterer-inbox" className="flex items-center gap-2 text-sm font-semibold">
        <Inbox className="size-4 text-muted-foreground" aria-hidden="true" /> Inbox
      </h2>
      {inbox.isError ? (
        <p className="text-sm text-unsafe">Couldn't load messages: {inbox.error.message}</p>
      ) : notes.length === 0 ? (
        <p className="text-sm text-muted-foreground">New meal lists and delay alerts from JAL show up here.</p>
      ) : (
        <ul className="flex flex-col divide-y text-sm">
          {notes.slice(0, 8).map((n) => (
            <li key={n.id} className="py-2">
              <div className="font-medium">{n.title}</div>
              <div className="text-muted-foreground">
                <span className="tabular">{fmtTime(n.at, "IST", { date: true })}</span> · {n.body}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export function CatererPage() {
  const lists = useMealLists()
  const [picked, setPicked] = useState<string | null>(null)
  const versions = lists.data ?? []
  const selected = versions.find((v) => v.id === picked) ?? versions[0]
  const previous = selected ? versions.find((v) => v.version === selected.version - 1) : undefined

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8">
      <PageHeader
        eyebrow="Skyline Flight Kitchens, Delhi · JL740 · 25 Oct"
        title="Meal lists"
        subtitle="Every list JAL sends is numbered, timestamped and hashed. Acknowledging one confirms the kitchen has it."
      />
      {lists.isError ? (
        <EmptyState
          title="Couldn't load the meal lists"
          body={lists.error.message}
          action={
            <Button variant="outline" onClick={() => lists.refetch()}>
              <RefreshCw /> Retry
            </Button>
          }
        />
      ) : lists.isPending ? (
        <div className="h-96 animate-pulse rounded-xl bg-ice" aria-busy="true" />
      ) : !selected ? (
        <EmptyState title="No meal list yet" body="The first list arrives at the special-meal cutoff, 25 hours before departure (24 Oct 03:35 IST)." />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)_300px]">
          <section className="self-start rounded-xl border bg-card p-2">
            <VersionList versions={versions} selectedId={selected.id} onSelect={setPicked} />
          </section>
          <section className="min-w-0 rounded-xl border bg-card p-5">
            <VersionDetail version={selected} previous={previous} />
          </section>
          <CatererInbox />
        </div>
      )}
      <BackupForecast />
    </div>
  )
}
