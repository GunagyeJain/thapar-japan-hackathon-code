// /caterer/recipes: a Japanese recipe sheet goes from photo (or text) to per-diet verdicts to an approved meal spec.
import { FileText, ImageUp, RefreshCw } from "lucide-react"
import { useRef, useState, type DragEvent } from "react"

import { t } from "@/lib/i18n"
import type { Lang } from "@/lib/types"
import { cn } from "@/lib/utils"
import { Button, EmptyState, LangSwitch, PageHeader, StatusChip } from "@/ui"

import { DEMO_SHEETS, demoPhoto, useExtract, useRecipeSheets, type Upload } from "./data"
import { s } from "./i18n"
import { SheetResult } from "./SheetResult"
import type { RecipeSheet } from "./types"

const PHOTO_TYPES = ["image/png", "image/jpeg", "image/webp"]

export function RecipePage() {
  const [lang, setLang] = useState<Lang>("en")
  const sheets = useRecipeSheets()
  const extract = useExtract()
  const [picked, setPicked] = useState<string | null>(null)
  // Photos stay in the browser for the side-by-side view; the server keeps only what it read.
  const [photos, setPhotos] = useState<Record<string, string>>({})

  const list = sheets.data ?? []
  const selected = list.find((x) => x.id === picked) ?? list[0]

  const send = (u: Upload, preview?: string) =>
    extract.mutate(u, {
      onSuccess: (sheet) => {
        setPicked(sheet.id)
        if (preview) setPhotos((p) => ({ ...p, [sheet.id]: preview }))
      },
    })
  const sendPhoto = (file: File, preview = URL.createObjectURL(file)) => send({ kind: "photo", file }, preview)

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8">
      <PageHeader eyebrow={t(s.eyebrow, lang)} title={t(s.title, lang)} subtitle={t(s.subtitle, lang)} actions={<LangSwitch value={lang} onChange={setLang} langs={["en", "ja"]} />} />

      <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="flex flex-col gap-4 self-start">
          <UploadCard lang={lang} busy={extract.isPending} onPhoto={sendPhoto} onText={(text) => send({ kind: "text", text })} />
          {extract.isError && (
            <p role="alert" className="rounded-[10px] border border-unsafe/30 bg-unsafe-bg p-3 text-sm text-unsafe">
              {extract.error.message}
            </p>
          )}

          <section className="rounded-[10px] border border-line bg-card p-3">
            <h2 className="mb-2 text-sm font-medium text-grey">{t(s.demo, lang)}</h2>
            <ul className="flex flex-col gap-1">
              {DEMO_SHEETS.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-2">
                  <span className="text-sm">
                    <span lang="ja" className="font-medium text-navy">{d.ja}</span> <span className="text-grey">{d.en}</span>
                  </span>
                  <span className="flex gap-1">
                    <Button size="icon" variant="ghost" aria-label={`${d.en}: ${t(s.photo, "en")}`} title={t(s.photo, lang)} disabled={extract.isPending} onClick={async () => sendPhoto(await demoPhoto(d), d.png)}>
                      <ImageUp />
                    </Button>
                    <Button size="icon" variant="ghost" aria-label={`${d.en}: text`} title={t(s.check, lang)} disabled={extract.isPending} onClick={() => send({ kind: "text", text: d.text })}>
                      <FileText />
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-[10px] border border-line bg-card p-3">
            <h2 className="mb-2 text-sm font-medium text-grey">{t(s.history, lang)}</h2>
            {sheets.isError ? (
              <Button variant="outline" size="sm" onClick={() => sheets.refetch()}>
                <RefreshCw /> {sheets.error.message}
              </Button>
            ) : sheets.isPending ? (
              <div className="h-20 animate-pulse rounded-md bg-ice" />
            ) : list.length === 0 ? (
              <p className="text-sm text-grey">{t(s.noSheets, lang)}</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {list.map((x) => (
                  <HistoryRow key={x.id} sheet={x} active={x.id === selected?.id} lang={lang} onClick={() => setPicked(x.id)} />
                ))}
              </ul>
            )}
          </section>
        </aside>

        <section className="min-w-0" aria-live="polite">
          {extract.isPending ? (
            <div className="flex flex-col gap-4" aria-busy="true" aria-label={t(s.reading, lang)}>
              <p className="text-sm text-grey">{t(s.reading, lang)}</p>
              <div className="h-24 animate-pulse rounded-[10px] bg-ice" />
              <div className="h-96 animate-pulse rounded-[10px] bg-ice" />
            </div>
          ) : selected ? (
            <SheetResult sheet={selected} photo={photos[selected.id]} lang={lang} />
          ) : (
            <EmptyState title={t(s.pickOne, lang)} icon={FileText} />
          )}
        </section>
      </div>
    </div>
  )
}

function HistoryRow({ sheet, active, lang, onClick }: { sheet: RecipeSheet; active: boolean; lang: Lang; onClick: () => void }) {
  const unsafe = sheet.verdicts.filter((v) => v.verdict === "UNSAFE").length
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={cn("flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors", active ? "bg-ice text-navy" : "hover:bg-mist")}
      >
        <span lang="ja" className="truncate font-medium">
          {sheet.name.ja || sheet.name.en}
        </span>
        {sheet.status === "approved" ? (
          <StatusChip status="safe" size="sm" label={t(s.approved, lang)} />
        ) : (
          <StatusChip status={unsafe ? "unsafe" : "warn"} size="sm" label={unsafe ? t(s.unsafeFor, lang).replace("{n}", String(unsafe)) : t(s.needsReview, lang)} />
        )}
      </button>
    </li>
  )
}

function UploadCard({ lang, busy, onPhoto, onText }: { lang: Lang; busy: boolean; onPhoto: (f: File) => void; onText: (text: string) => void }) {
  const [over, setOver] = useState(false)
  const [text, setText] = useState("")
  const input = useRef<HTMLInputElement>(null)
  const take = (file?: File) => {
    if (file && PHOTO_TYPES.includes(file.type)) onPhoto(file)
  }
  const drop = (e: DragEvent) => {
    e.preventDefault()
    setOver(false)
    take(e.dataTransfer.files[0])
  }

  return (
    <section className="flex flex-col gap-3 rounded-[10px] border border-line bg-card p-3">
      <h2 className="text-sm font-medium text-grey">{t(s.upload, lang)}</h2>
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={drop}
        className={cn("flex flex-col items-center gap-2 rounded-md border border-dashed px-3 py-5 text-center text-sm transition-colors", over ? "border-blue bg-ice" : "border-line")}
      >
        <ImageUp className="size-5 text-sky" aria-hidden="true" />
        <span className="text-navy">{t(s.drop, lang)}</span>
        <span className="text-xs text-grey">{t(s.photoTypes, lang)}</span>
        <Button variant="outline" size="sm" disabled={busy} onClick={() => input.current?.click()}>
          {t(s.chooseFile, lang)}
        </Button>
        <input ref={input} type="file" accept={PHOTO_TYPES.join(",")} className="hidden" onChange={(e) => take(e.target.files?.[0])} />
      </div>
      <label className="flex flex-col gap-1.5 text-xs text-grey">
        {t(s.orPaste, lang)}
        <textarea
          lang="ja"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t(s.pastePlaceholder, lang)}
          rows={4}
          className="resize-y rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        />
      </label>
      <Button disabled={busy || !text.trim()} onClick={() => onText(text)}>
        {busy ? t(s.reading, lang) : t(s.check, lang)}
      </Button>
    </section>
  )
}
