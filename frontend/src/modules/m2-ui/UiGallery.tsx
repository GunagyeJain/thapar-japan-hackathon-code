// "/ui": every shared component, in light and cabin dark, with real JL740 data.
import { useState } from "react"
import { PackageSearch } from "lucide-react"

import { useFlight } from "@/lib/flight"
import type { Lang } from "@/lib/types"
import {
  Badge,
  Button,
  Countdown,
  DualClock,
  EmptyState,
  FlightContextBar,
  LangSwitch,
  PageHeader,
  StatusChip,
  VerdictBadge,
} from "@/ui"
import { DataExamples } from "@/modules/m2-ui/DataExamples"
import { DASHI_CHECK, PRIYA_AVML_SPARE } from "@/modules/m2-ui/examples"
import { Specimen } from "@/modules/m2-ui/Specimen"

const TOKENS = ["navy", "blue", "sky", "ice", "mist", "line", "grey", "safe", "warn", "unsafe"] as const

function Swatches() {
  return (
    <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
      {TOKENS.map((tk) => (
        <div key={tk} className="flex flex-col gap-1">
          <div className="h-12 rounded-md border" style={{ background: `var(--${tk})` }} />
          <span className="code text-[11px] text-muted-foreground">--{tk}</span>
        </div>
      ))}
    </div>
  )
}

export function UiGallery() {
  const [lang, setLang] = useState<Lang>("en")
  const flight = useFlight()
  const f = flight.data

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-10 px-6 py-8">
      <PageHeader
        eyebrow="m2 · design system"
        title="UI kit"
        subtitle="Build every screen from these and the tokens. Left: light. Right: crew cabin mode."
        actions={<LangSwitch value={lang} onChange={setLang} />}
      />

      <Specimen name="Tokens" usage="bg-navy text-blue border-line bg-safe-bg text-unsafe …" dark={false}>
        <Swatches />
      </Specimen>

      <Specimen name="Type" usage="font-display (Archivo) · font-sans (Inter) · :lang(ja) Noto Sans JP · :lang(hi) Hind · .tabular · .code">
        <div className="flex flex-col gap-1">
          <span className="font-display text-5xl font-bold tracking-tight tabular">186</span>
          <span className="font-display text-2xl font-semibold">Meal list v3 received 00:40 IST</span>
          <span>27D: use the backup veg meal from galley 2</span>
          <span lang="ja">27D：ギャレー2の予備ベジ食を使用</span>
          <span lang="hi">आपका भोजन बहाल कर दिया गया है</span>
          <span className="code text-sm">6XK2QP · TB-7K2Q9F · -NRT156Y</span>
        </div>
      </Specimen>

      <Specimen name="StatusChip" usage={'<StatusChip status="safe" label="Found" />'}>
        <StatusChip status="safe" label="Found" />
        <StatusChip status="warn" label="At risk" />
        <StatusChip status="unsafe" label="Lost on rebooking" />
        <StatusChip status="info" label="Late request" />
        <StatusChip status="neutral" label="Pending" />
        <StatusChip status="safe" label="Right tray" size="lg" />
        <StatusChip status="unsafe" label="Wrong tray" size="lg" />
      </Specimen>

      <Specimen name="VerdictBadge" usage="<VerdictBadge verdict={v} fired={fired} lang={lang} />">
        <VerdictBadge verdict="SAFE" lang={lang} />
        <VerdictBadge verdict="UNSAFE" fired={PRIYA_AVML_SPARE} lang={lang} />
        <VerdictBadge verdict="NEEDS_HUMAN" fired={DASHI_CHECK} lang={lang} />
      </Specimen>

      <Specimen name="Countdown" usage={'<Countdown until={flight.caterer_final_list_at} warnUnder="2h" />'}>
        {f ? (
          <>
            <Countdown until={f.caterer_final_list_at} label="Caterer list" />
            <Countdown until={f.special_meal_cutoff} label="Cutoff" warnUnder="24h" />
            <Countdown until="2026-10-23T18:00:00+05:30" label="Story start" />
            <Countdown until={f.caterer_final_list_at} size="lg" label="Caterer's final list" />
          </>
        ) : (
          <span className="text-muted-foreground">Loading JL740…</span>
        )}
      </Specimen>

      <Specimen name="DualClock" usage={'<DualClock size="lg" />'}>
        <DualClock />
        <DualClock size="lg" />
      </Specimen>

      <Specimen name="FlightContextBar" usage="<FlightContextBar /> (DesktopLayout shows it on every desktop page)">
        <FlightContextBar className="w-full rounded-lg border" />
      </Specimen>

      <Specimen name="PageHeader" usage={'<PageHeader title="Ops console" subtitle="…" actions={…} />'}>
        <PageHeader
          className="w-full"
          eyebrow="JL740 · 25 Oct"
          title="Ops console"
          subtitle="2 open alerts · PNL received 23 Oct 18:00 IST"
          actions={<Button>Request again</Button>}
        />
      </Specimen>

      <Specimen name="EmptyState" usage={'<EmptyState title="No ADL yet" body="…" />'}>
        <EmptyState
          className="w-full"
          icon={PackageSearch}
          title="No ADL received yet"
          body="Changes after the PNL appear here as soon as the booking feed sends an ADL."
        />
      </Specimen>

      <Specimen name="LangSwitch" usage="<LangSwitch value={lang} onChange={setLang} />">
        <LangSwitch value={lang} onChange={setLang} />
      </Specimen>

      <Specimen name="Button · Badge" usage={'<Button variant="outline" /> · <Badge variant="secondary" />'}>
        <Button>Acknowledge</Button>
        <Button variant="outline">Print labels</Button>
        <Button variant="secondary">Notify passenger</Button>
        <Button variant="ghost">Dismiss</Button>
        <Badge variant="secondary" className="code">AVML</Badge>
        <Badge variant="outline" className="code">VJML</Badge>
      </Specimen>

      <DataExamples lang={lang} />
    </div>
  )
}
