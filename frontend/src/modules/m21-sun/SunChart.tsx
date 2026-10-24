// Height of the sun along a flight: at the aircraft (blue) and on the ground at the origin (sky, dashed),
// the sunrise line at cruise height (grey, dashed) and both sunrises marked. Plain SVG in the chart tokens.
import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react"

import { fmtTime } from "@/lib/format"
import { t } from "@/lib/i18n"
import type { Lang } from "@/lib/types"

import { city, fmtDeg, fmtLeft, fmtPosition, istHourTicks, niceRange } from "./format"
import { fill, s } from "./i18n"
import type { SunFlight } from "./types"

const HEIGHT = 340
const PAD = { top: 60, right: 24, bottom: 44, left: 52 }
const Y_STEP = 15
const GROUND_LINE = -0.833
const CLIMB_MS = 25 * 60_000
const DESCENT_MS = 30 * 60_000
const ROW_TITLE = 16 // marker names
const ROW_TIME = 33 // marker times and the gap between them
const ROW_BRACKET = 44 // the dimension line between the two sunrises
const MARKER_TOP = 4
const TIP_WIDTH = 230
const ARROW_ID = "m21-gap-arrow"

interface Point {
  at: number
  elev: number
  ground: number
  alt: number
  lat: number
  lon: number
}

function useWidth() {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return [ref, width] as const
}

export interface SunChartProps {
  flight: SunFlight
  lang: Lang
  now: Date | null
}

export function SunChart({ flight, lang, now }: SunChartProps) {
  const [ref, width] = useWidth()
  const [hover, setHover] = useState<number | null>(null)
  const points = useMemo<Point[]>(
    () => flight.track.map((p) => ({ at: Date.parse(p.at), elev: p.elev, ground: p.elev_origin, alt: p.alt_m, lat: p.lat, lon: p.lon })),
    [flight.track],
  )
  const origin = city(flight.origin, lang)
  const t0 = Date.parse(flight.dep)
  const t1 = Date.parse(flight.arr)
  const [yMin, yMax] = niceRange([...points.flatMap((p) => [p.elev, p.ground]), flight.threshold_cruise], Y_STEP)
  const plotW = Math.max(width - PAD.left - PAD.right, 1)
  const plotH = HEIGHT - PAD.top - PAD.bottom
  const x = (at: number) => PAD.left + ((at - t0) / (t1 - t0)) * plotW
  const y = (deg: number) => PAD.top + ((yMax - deg) / (yMax - yMin)) * plotH
  const path = (key: "elev" | "ground") =>
    points.map((p, i) => `${i ? "L" : "M"}${x(p.at).toFixed(1)} ${y(p[key]).toFixed(1)}`).join(" ")
  const yTicks = Array.from({ length: (yMax - yMin) / Y_STEP + 1 }, (_, i) => yMin + i * Y_STEP)
  const inFlight = (at: number) => at >= t0 && at <= t1

  const rise = flight.sunrise
  const tA = rise ? Date.parse(rise.at_aircraft) : null
  const tD = rise?.at_origin ? Date.parse(rise.at_origin) : null
  const showA = tA !== null && inFlight(tA)
  const showD = tD !== null && inFlight(tD)
  const nowMs = now?.getTime() ?? null
  const tip = hover === null ? null : points[hover]

  function onMove(e: PointerEvent<SVGRectElement>) {
    const box = e.currentTarget.getBoundingClientRect()
    const at = t0 + ((e.clientX - box.left) / box.width) * (t1 - t0)
    let best = 0
    points.forEach((p, i) => {
      if (Math.abs(p.at - at) < Math.abs(points[best].at - at)) best = i
    })
    setHover(best)
  }

  const summary = rise?.minutes_earlier != null ? fill(t(s.explain, lang), { n: rise.minutes_earlier, city: origin }) : t(s.chartTitle, lang)

  return (
    <div ref={ref} className="relative w-full">
      {width > 0 && (
        <svg width={width} height={HEIGHT} role="img" aria-label={summary} className="block select-none">
          <defs>
            <marker id={ARROW_ID} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0 0 L8 4 L0 8 z" fill="var(--grey)" />
            </marker>
          </defs>
          {/* climb and descent: the sunrise line moves while the altitude changes */}
          <rect x={x(t0)} y={PAD.top} width={x(t0 + CLIMB_MS) - x(t0)} height={plotH} fill="var(--ice)" />
          <rect x={x(t1 - DESCENT_MS)} y={PAD.top} width={x(t1) - x(t1 - DESCENT_MS)} height={plotH} fill="var(--ice)" />
          <text x={(x(t0) + x(t0 + CLIMB_MS)) / 2} y={PAD.top + 14} textAnchor="middle" className="fill-muted-foreground text-[11px]">
            {t(s.climb, lang)}
          </text>
          <text x={(x(t1 - DESCENT_MS) + x(t1)) / 2} y={PAD.top + 14} textAnchor="middle" className="fill-muted-foreground text-[11px]">
            {t(s.descent, lang)}
          </text>

          {yTicks.map((v) => (
            <g key={v}>
              <line x1={PAD.left} x2={PAD.left + plotW} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeWidth={v === 0 ? 1.5 : 1} />
              <text x={PAD.left - 8} y={y(v)} dy="0.32em" textAnchor="end" className="fill-muted-foreground text-xs tabular">
                {fmtDeg(v, 0)}
              </text>
            </g>
          ))}
          {istHourTicks(t0, t1).map((at) => (
            <g key={at}>
              <line x1={x(at)} x2={x(at)} y1={PAD.top + plotH} y2={PAD.top + plotH + 5} stroke="var(--grey)" />
              <text x={x(at)} y={PAD.top + plotH + 19} textAnchor="middle" className="fill-muted-foreground text-xs tabular">
                {fmtTime(new Date(at), "IST", { zone: false })}
              </text>
            </g>
          ))}
          <text x={PAD.left + plotW} y={HEIGHT - 4} textAnchor="end" className="fill-muted-foreground text-xs">
            {t(s.axisTime, lang)}
          </text>

          {/* the sunrise line at cruise height */}
          <line x1={PAD.left} x2={PAD.left + plotW} y1={y(flight.threshold_cruise)} y2={y(flight.threshold_cruise)} stroke="var(--grey)" strokeWidth={1.5} strokeDasharray="6 4" />
          <text x={PAD.left + plotW - 4} y={y(flight.threshold_cruise) - 6} textAnchor="end" className="fill-muted-foreground text-xs">
            {fill(t(s.legendLine, lang), { deg: fmtDeg(flight.threshold_cruise) })}
          </text>

          <path d={path("ground")} fill="none" stroke="var(--sky)" strokeWidth={2} strokeDasharray="7 5" />
          <path d={path("elev")} fill="none" stroke="var(--blue)" strokeWidth={2.5} strokeLinejoin="round" />

          {showA && tA !== null && rise && (
            <g>
              <line x1={x(tA)} x2={x(tA)} y1={MARKER_TOP} y2={PAD.top + plotH} stroke="var(--blue)" strokeOpacity={0.55} />
              <circle cx={x(tA)} cy={y(flight.threshold_cruise)} r={5} fill="var(--blue)" stroke="var(--card)" strokeWidth={2} />
              <text x={x(tA) - 8} y={ROW_TITLE} textAnchor="end" className="fill-muted-foreground text-xs">
                {t(s.kpiAircraft, lang)}
              </text>
              <text x={x(tA) - 8} y={ROW_TIME} textAnchor="end" className="fill-foreground text-[13px] font-semibold tabular">
                {fmtTime(rise.at_aircraft, "IST")}
              </text>
            </g>
          )}
          {showD && tD !== null && rise?.at_origin && (
            <g>
              <line x1={x(tD)} x2={x(tD)} y1={MARKER_TOP} y2={PAD.top + plotH} stroke="var(--sky)" strokeOpacity={0.8} />
              <circle cx={x(tD)} cy={y(GROUND_LINE)} r={5} fill="var(--sky)" stroke="var(--card)" strokeWidth={2} />
              <text x={x(tD) + 8} y={ROW_TITLE} className="fill-muted-foreground text-xs">
                {fill(t(s.kpiOrigin, lang), { city: origin })}
              </text>
              <text x={x(tD) + 8} y={ROW_TIME} className="fill-foreground text-[13px] font-semibold tabular">
                {fmtTime(rise.at_origin, "IST")}
              </text>
            </g>
          )}
          {showA && showD && tA !== null && tD !== null && rise?.minutes_earlier != null && (
            <g>
              <line
                x1={x(tA) + 2}
                x2={x(tD) - 2}
                y1={ROW_BRACKET}
                y2={ROW_BRACKET}
                stroke="var(--grey)"
                strokeWidth={1.25}
                markerStart={`url(#${ARROW_ID})`}
                markerEnd={`url(#${ARROW_ID})`}
              />
              <text x={(x(tA) + x(tD)) / 2} y={ROW_TIME} textAnchor="middle" className="fill-foreground text-[13px] font-semibold tabular">
                {fmtLeft(rise.minutes_earlier * 60_000, lang)}
              </text>
            </g>
          )}

          {nowMs !== null && inFlight(nowMs) && (
            <g>
              <line x1={x(nowMs)} x2={x(nowMs)} y1={PAD.top} y2={PAD.top + plotH} stroke="var(--navy)" strokeDasharray="3 3" />
              <text x={x(nowMs) + 4} y={PAD.top + plotH - 8} className="fill-foreground text-[11px] font-medium tabular">
                {t(s.now, lang)} {fmtTime(new Date(nowMs), "IST", { zone: false })}
              </text>
            </g>
          )}

          {tip && (
            <g pointerEvents="none">
              <line x1={x(tip.at)} x2={x(tip.at)} y1={PAD.top} y2={PAD.top + plotH} stroke="var(--grey)" strokeDasharray="2 3" />
              <circle cx={x(tip.at)} cy={y(tip.ground)} r={4} fill="var(--sky)" stroke="var(--card)" strokeWidth={1.5} />
              <circle cx={x(tip.at)} cy={y(tip.elev)} r={4} fill="var(--blue)" stroke="var(--card)" strokeWidth={1.5} />
            </g>
          )}
          <rect
            x={PAD.left}
            y={PAD.top}
            width={plotW}
            height={plotH}
            fill="transparent"
            onPointerMove={onMove}
            onPointerLeave={() => setHover(null)}
          />
        </svg>
      )}
      {tip && (
        <div
          className="pointer-events-none absolute z-10 flex flex-col gap-1 rounded-md border bg-popover px-3 py-2 text-xs shadow-overlay tabular"
          style={{ left: Math.min(Math.max(x(tip.at) + 12, 0), Math.max(width - TIP_WIDTH, 0)), top: PAD.top, width: TIP_WIDTH }}
        >
          <span className="font-semibold">
            {fmtTime(new Date(tip.at), "IST")} · {fmtTime(new Date(tip.at), "JST")}
          </span>
          <span className="flex justify-between gap-2">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-blue" aria-hidden="true" />
              {t(s.tipAircraft, lang)}
            </span>
            <span className="font-medium">{fmtDeg(tip.elev)}</span>
          </span>
          <span className="flex justify-between gap-2">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-sky" aria-hidden="true" />
              {fill(t(s.tipOrigin, lang), { city: origin })}
            </span>
            <span className="font-medium">{fmtDeg(tip.ground)}</span>
          </span>
          <span className="text-muted-foreground">
            {t(s.tipAlt, lang)} {tip.alt.toLocaleString("en-US")} m · {fmtPosition(tip.lat, tip.lon)}
          </span>
        </div>
      )}
    </div>
  )
}
