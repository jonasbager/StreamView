'use client'

import { useState } from 'react'
import type { FrontierPoint } from '@/lib/engine'
import { kr } from '@/lib/format'

export const SERIES = { legal: '#1f8a5c', flex: '#c2731f' }

interface Series {
  key: 'legal' | 'flex'
  label: string
  points: FrontierPoint[]
}

/**
 * Step chart: how many wishes each budget buys. Each series is the cheapest
 * price for a given number of services; the vertical line is the budget.
 */
export function FrontierChart({ series, budget, total, onPick }: { series: Series[]; budget: number; total: number; onPick: (budget: number) => void }) {
  const [hover, setHover] = useState<number | null>(null)
  const W = 640
  const H = 220
  const pad = { l: 36, r: 16, t: 14, b: 30 }
  const maxX = Math.max(budget, ...series.flatMap((s) => s.points.map((p) => p.monthly))) * 1.08 || 1
  const minX = Math.min(...series.flatMap((s) => s.points.map((p) => p.monthly)), budget) * 0.92
  const x = (v: number) => pad.l + ((v - minX) / (maxX - minX)) * (W - pad.l - pad.r)
  const y = (n: number) => H - pad.b - (n / Math.max(1, total)) * (H - pad.t - pad.b)

  // For a budget b, a series gives the most services of any point costing <= b.
  const atBudget = (s: Series, b: number) => s.points.find((p) => p.monthly <= b + 0.5)?.services.length ?? 0
  const path = (s: Series) => {
    const pts = [...s.points].sort((a, b) => a.monthly - b.monthly)
    let d = `M ${x(minX)} ${y(0)}`
    for (const p of pts) d += ` H ${x(p.monthly)} V ${y(p.services.length)}`
    return d + ` H ${x(maxX)}`
  }
  const ticks = niceTicks(minX, maxX, 4)
  const yTicks = [...new Set([0, Math.round(total / 2), total])]

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-ink-2">
        {series.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-2">
            <span className="h-0.5 w-4 rounded" style={{ background: SERIES[s.key] }} />
            {s.label}
          </span>
        ))}
        <span className="inline-flex items-center gap-2">
          <span className="h-3 w-px bg-ink" /> Jeres budget
        </span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full touch-none select-none"
        role="img"
        aria-label="Antal ønskede tjenester I kan få for hvert budget"
        onPointerMove={(e) => {
          const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect()
          const px = ((e.clientX - r.left) / r.width) * W
          setHover(Math.max(minX, Math.min(maxX, minX + ((px - pad.l) / (W - pad.l - pad.r)) * (maxX - minX))))
        }}
        onPointerLeave={() => setHover(null)}
        onClick={() => hover != null && onPick(Math.round(hover / 10) * 10)}
      >
        {yTicks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--color-line)" />
            <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--color-ink-3)">{t}</text>
          </g>
        ))}
        {ticks.map((t) => (
          <text key={t} x={x(t)} y={H - 10} textAnchor="middle" fontSize="11" fill="var(--color-ink-3)">{`${Math.round(t).toLocaleString('da-DK')} kr.`}</text>
        ))}
        {series.map((s) => (
          <path key={s.key} d={path(s)} fill="none" stroke={SERIES[s.key]} strokeWidth="2" strokeLinejoin="round" />
        ))}
        {/* Direct labels at the full-coverage end of each line */}
        {series.map((s, i) => {
          const top = s.points[0]
          return (
            <text key={s.key} x={Math.min(x(top.monthly) + 6, W - pad.r - 4)} y={y(top.services.length) - 6 - i * 13} fontSize="11" fill="var(--color-ink-2)" textAnchor={x(top.monthly) > W - 120 ? 'end' : 'start'}>
              {s.label}: alle for {kr(top.monthly)}
            </text>
          )
        })}
        <line x1={x(budget)} x2={x(budget)} y1={pad.t} y2={H - pad.b} stroke="var(--color-ink)" strokeWidth="1.5" />
        {hover != null && (
          <g pointerEvents="none">
            <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={H - pad.b} stroke="var(--color-ink-3)" strokeDasharray="3 3" />
            {series.map((s) => (
              <circle key={s.key} cx={x(hover)} cy={y(atBudget(s, hover))} r="4.5" fill={SERIES[s.key]} stroke="#fff" strokeWidth="2" />
            ))}
          </g>
        )}
      </svg>
      <div className="h-5 text-sm text-ink-2" aria-live="polite">
        {hover != null && (
          <>
            For <b className="num text-ink">{kr(hover)}</b>:{' '}
            {series.map((s, i) => (
              <span key={s.key}>
                {i > 0 && ' · '}
                {s.label.toLowerCase()} <b className="num text-ink">{atBudget(s, hover)}</b> af {total}
              </span>
            ))}
            <span className="text-ink-3"> · klik for at vælge</span>
          </>
        )}
      </div>
    </div>
  )
}

function niceTicks(min: number, max: number, count: number) {
  const step = Math.pow(10, Math.floor(Math.log10((max - min) / count)))
  const err = (max - min) / count / step
  const s = step * (err >= 7.5 ? 10 : err >= 3.5 ? 5 : err >= 1.5 ? 2 : 1)
  const out: number[] = []
  for (let v = Math.ceil(min / s) * s; v <= max; v += s) out.push(v)
  return out
}
