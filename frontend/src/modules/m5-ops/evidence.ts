// Reading PNL/ADL evidence: find a passenger's block, mark it, and pull before/after booking lines.
import type { Alert, Passenger, RawMessage } from "@/lib/types"

export type Tone = "add" | "remove" | "mark"

/** "1SHARMA/PRIYAMS": the name line prefix in our PNL/ADL subset. */
export function nameKey(p: Pick<Passenger, "surname" | "given">): string {
  return `1${p.surname}/${p.given}`.toUpperCase()
}

const NAME_LINE = /^\d+[A-Z]/
const SECTION = /^(ADD|DEL|CHG)$/

/** 1-based line numbers of each block for this passenger, with the ADL section it sits in. */
export function blocksFor(text: string, key: string): { lines: number[]; section: string | null }[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n")
  const blocks: { lines: number[]; section: string | null }[] = []
  let section: string | null = null
  let current: { lines: number[]; section: string | null } | null = null
  lines.forEach((raw, i) => {
    const line = raw.trim()
    if (SECTION.test(line)) section = line
    if (NAME_LINE.test(line) || SECTION.test(line) || line.startsWith("END") || line.startsWith("-")) current = null
    if (NAME_LINE.test(line) && line.toUpperCase().startsWith(key)) {
      current = { lines: [], section }
      blocks.push(current)
    }
    if (current) current.lines.push(i + 1)
  })
  return blocks
}

export function highlightFor(message: RawMessage, key: string): Record<number, Tone> {
  const marks: Record<number, Tone> = {}
  for (const block of blocksFor(message.text, key)) {
    const tone: Tone = block.section === "DEL" ? "remove" : block.section ? "add" : "mark"
    for (const n of block.lines) marks[n] = tone
  }
  return marks
}

function linesOf(message: RawMessage, numbers: number[]): string[] {
  const all = message.text.replace(/\r\n/g, "\n").split("\n")
  return numbers.map((n) => all[n - 1].trim())
}

/** The booking as the PNL had it, and as the latest ADL left it (for the DiffView). */
export function beforeAfter(messages: RawMessage[], key: string): { before: string[]; after: string[] } | null {
  const ordered = [...messages].sort((a, b) => a.seq - b.seq)
  const pnl = ordered.find((m) => m.kind === "PNL" && blocksFor(m.text, key).length > 0)
  const adls = ordered.filter((m) => m.kind === "ADL" && blocksFor(m.text, key).some((b) => b.section === "ADD" || b.section === "CHG"))
  if (!pnl || adls.length === 0) return null
  const before = linesOf(pnl, blocksFor(pnl.text, key)[0].lines)
  const last = adls[adls.length - 1]
  const added = blocksFor(last.text, key).filter((b) => b.section === "ADD" || b.section === "CHG")
  return { before, after: linesOf(last, added[added.length - 1].lines) }
}

export function messageIds(alert: Alert): string[] {
  const ids = alert.evidence.message_ids
  return Array.isArray(ids) ? ids.filter((x): x is string => typeof x === "string") : []
}

export function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null
}
