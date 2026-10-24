// Caterer-side design: a standard veg tray in five sealed cups, and the fewest spare cups that make it safe for late needs.
import { t } from "@/lib/i18n"
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui"

import { s } from "./i18n"
import type { Bento } from "./types"

export function BentoSpares({ bento }: { bento: Bento }) {
  const slotLabel = Object.fromEntries(bento.slots.map((sl) => [sl.id, t(sl.label)]))
  const needLabel = Object.fromEntries(bento.needs.map((n) => [n.id, t(n.label)]))
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t(s.bentoTitle)}</CardTitle>
        <CardDescription>{t(bento.design)}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div>
          <div className="mb-1.5 text-xs font-medium text-muted-foreground">Standard veg tray</div>
          <ol className="grid grid-cols-5 gap-1.5">
            {bento.tray.map((cup) => (
              <li key={cup.id} className="flex flex-col gap-0.5 rounded-md border bg-card px-2 py-1.5">
                <span className="text-[11px] text-muted-foreground">{slotLabel[cup.slot]}</span>
                <span className="text-xs leading-tight font-medium">{t(cup.name)}</span>
              </li>
            ))}
          </ol>
        </div>
        <div>
          <div className="mb-1.5 text-xs font-medium text-muted-foreground">Cups that fail each late need</div>
          <ul className="flex flex-col gap-1 text-xs">
            {bento.needs.map((n) => (
              <li key={n.id} className="flex flex-wrap items-center gap-1.5">
                <span className="w-32 font-medium">{t(n.label)}</span>
                {n.fails.map((slot) => (
                  <Badge key={slot} variant="outline">
                    {slotLabel[slot]}
                  </Badge>
                ))}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="mb-1.5 text-xs font-medium text-muted-foreground">Spare cups to load (greedy set cover, p90 of pooled late needs)</div>
          <table className="w-full text-sm">
            <tbody>
              {bento.spares.map((sp) => (
                <tr key={sp.cup_id} className="border-b last:border-0">
                  <td className="w-10 py-1.5 align-top font-display text-lg font-bold tabular">{sp.count}×</td>
                  <td className="py-1.5">
                    <div>
                      <span className="font-medium">{t(sp.name)}</span>{" "}
                      <span className="text-xs text-muted-foreground">· {slotLabel[sp.slot]} cup</span>
                    </div>
                    <div className="text-xs text-muted-foreground">for {sp.covers.map((c) => needLabel[c]).join(", ")}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-sm">
          <span className="font-semibold tabular">{bento.total_cups} cups</span> turn standard trays into safe ones for all
          four late needs; stocking each need apart takes <span className="tabular">{bento.cups_if_stocked_apart}</span>.
        </p>
      </CardContent>
    </Card>
  )
}
