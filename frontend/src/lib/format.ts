// Time and duration formatting. Times always show their zone: "00:40 IST", "15:20 JST".

export type Zone = "IST" | "JST"

const ZONES: Record<Zone, string> = { IST: "Asia/Kolkata", JST: "Asia/Tokyo" }

const timeFormatters = new Map<string, Intl.DateTimeFormat>()

function formatter(zone: Zone, withDate: boolean): Intl.DateTimeFormat {
  const key = `${zone}:${withDate}`
  let f = timeFormatters.get(key)
  if (!f) {
    f = new Intl.DateTimeFormat("en-GB", {
      timeZone: ZONES[zone],
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      ...(withDate ? { day: "numeric", month: "short" } : {}),
    })
    timeFormatters.set(key, f)
  }
  return f
}

/** "04:35 IST", or with date "25 Oct, 04:35 IST". */
export function fmtTime(iso: string | Date, zone: Zone = "IST", opts: { date?: boolean; zone?: boolean } = {}): string {
  const d = typeof iso === "string" ? new Date(iso) : iso
  const text = formatter(zone, opts.date ?? false).format(d)
  return opts.zone === false ? text : `${text} ${zone}`
}

/** "1 h 38 m" ("1 h 38 m 05 s" with seconds), "12 m 05 s" under an hour, "0 s" once passed. */
export function fmtDuration(ms: number, opts: { seconds?: boolean } = {}): string {
  if (ms <= 0) return "0 s"
  const totalS = Math.floor(ms / 1000)
  const h = Math.floor(totalS / 3600)
  const m = Math.floor((totalS % 3600) / 60)
  const s = String(totalS % 60).padStart(2, "0")
  if (h > 0) return `${h} h ${String(m).padStart(2, "0")} m${opts.seconds ? ` ${s} s` : ""}`
  return `${m} m ${s} s`
}

/** "SHARMA/PRIYA MS" as printed on PNL lines and labels. */
export function fmtPaxName(p: { surname: string; given: string; title: string }): string {
  return `${p.surname}/${p.given} ${p.title}`
}
