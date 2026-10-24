// The rules spelled out: every diet's forbidden families, and what each JAL meal code guarantees.
import { t } from "@/lib/i18n"
import { label, loadRules } from "@/lib/rules"
import type { Lang } from "@/lib/types"
import { STR } from "@/modules/m1-rules/i18n"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/ui/table"

function TagList({ tags, lang, tone = "plain" }: { tags: string[]; lang: Lang; tone?: "plain" | "out" }) {
  if (tags.length === 0) return <span className="text-grey">—</span>
  return (
    <ul className="flex flex-wrap gap-1">
      {tags.map((tag) => (
        <li
          key={tag}
          className={tone === "out" ? "rounded-md bg-ice px-1.5 py-0.5 text-xs text-navy" : "rounded-md border px-1.5 py-0.5 text-xs text-grey"}
        >
          {label(tag, lang)}
        </li>
      ))}
    </ul>
  )
}

export function DietsTable({ lang }: { lang: Lang }) {
  const diets = [...loadRules().diets.values()]
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-48">Diet</TableHead>
          <TableHead>Never contains</TableHead>
          <TableHead className="w-56">Eats</TableHead>
          <TableHead>In plain words</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {diets.map((d) => (
          <TableRow key={d.id} className="align-top">
            <TableCell className="font-medium text-navy">
              {t(d.labels, lang)}
              {d.kind === "allergen" && <span className="ml-1.5 text-xs font-normal text-grey">{t(STR.allergy, lang)}</span>}
            </TableCell>
            <TableCell className="whitespace-normal">
              <TagList tags={d.forbid} lang={lang} tone="out" />
            </TableCell>
            <TableCell className="whitespace-normal">
              <TagList tags={d.allow} lang={lang} />
            </TableCell>
            <TableCell className="whitespace-normal text-grey">{d.notes ? t(d.notes, lang) : "—"}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

export function CodesTable({ lang }: { lang: Lang }) {
  const codes = loadRules().codes
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-20">Code</TableHead>
          <TableHead className="w-56">Meal</TableHead>
          <TableHead>Never contains</TableHead>
          <TableHead>Always contains</TableHead>
          <TableHead>Often contains</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {codes.map((c) => (
          <TableRow key={c.code} className="align-top">
            <TableCell className="font-mono font-medium text-navy">{c.code}</TableCell>
            <TableCell className="whitespace-normal text-navy">{t(c.name, lang)}</TableCell>
            <TableCell className="whitespace-normal">
              <TagList tags={c.excludes} lang={lang} tone="out" />
            </TableCell>
            <TableCell className="whitespace-normal">
              <TagList tags={c.contains} lang={lang} />
            </TableCell>
            <TableCell className="whitespace-normal">
              <TagList tags={c.may_contain} lang={lang} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
