import Link from 'next/link'
import type { Enforcement } from '@/db/schema'
import { ENFORCEMENT_DA } from '@/lib/format'

export function Logo({ href = '/' }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2.5 text-[17px] font-semibold tracking-tight">
      <svg viewBox="0 0 32 32" className="size-7" aria-hidden>
        <rect width="32" height="32" rx="9" fill="var(--color-brand)" />
        <rect x="8" y="17" width="4" height="7" rx="2" fill="#f6f4ef" />
        <rect x="14" y="12" width="4" height="12" rx="2" fill="#f6f4ef" />
        <rect x="20" y="8" width="4" height="16" rx="2" fill="#f6f4ef" />
      </svg>
      StreamView
    </Link>
  )
}

const RISK_STYLE: Record<Enforcement, string> = {
  none: 'bg-brand-soft text-brand',
  low: 'bg-sunk text-ink-2',
  medium: 'bg-warn-soft text-warn',
  high: 'bg-warn-soft text-warn',
  strict: 'bg-risk-soft text-risk',
}

export function RiskPill({ level, label }: { level: Enforcement; label?: string }) {
  const filled = { none: 0, low: 1, medium: 2, high: 3, strict: 4 }[level]
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${RISK_STYLE[level]}`}>
      <span className="flex gap-0.5" aria-hidden>
        {[1, 2, 3, 4].map((i) => (
          <span key={i} className={`h-1.5 w-1.5 rounded-full ${i <= filled ? 'bg-current' : 'bg-current opacity-20'}`} />
        ))}
      </span>
      {label ?? ENFORCEMENT_DA[level]}
    </span>
  )
}

export function Mark({ name, color, size = 32 }: { name: string; color: string; size?: number }) {
  const letters = name.replace(/[^A-Za-zÆØÅæøå0-9+ ]/g, '').split(' ').map((w) => w[0]).join('').slice(0, 2)
  return (
    <span
      className="grid shrink-0 place-items-center rounded-[10px] font-semibold text-white"
      style={{ width: size, height: size, background: color, fontSize: Math.round(size * 0.38) }}
      aria-hidden
    >
      {letters}
    </span>
  )
}

const PEOPLE = ['#1f4d3a', '#8a5a2b', '#3d5a80', '#7a4b6b', '#4f6d3a', '#7d6b2f', '#2f6b6b', '#6b3d3d']
export const personColor = (i: number) => PEOPLE[i % PEOPLE.length]

export function Person({ name, color, size = 28 }: { name: string; color: string; size?: number }) {
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full font-semibold text-white ring-2 ring-card"
      style={{ width: size, height: size, background: color, fontSize: Math.round(size * 0.42) }}
      title={name}
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  )
}

export function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'brand' | 'muted' }) {
  return (
    <div>
      <div className="eyebrow">{label}</div>
      <div className={`num mt-1 text-3xl font-semibold tracking-tight ${tone === 'brand' ? 'text-brand' : tone === 'muted' ? 'text-ink-3' : ''}`}>{value}</div>
      {sub && <div className="mt-1 text-sm text-ink-2">{sub}</div>}
    </div>
  )
}
