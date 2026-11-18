import type { ReactNode } from 'react'
import type { Enforcement, Service } from '../lib/types'
import { ENFORCEMENT_LABEL, ENFORCEMENT_RANK } from '../lib/types'

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-white/8 bg-white/[0.03] ${className}`}>{children}</div>
}

const ENF_COLOR: Record<Enforcement, string> = {
  none: 'bg-emerald-400',
  low: 'bg-lime-400',
  medium: 'bg-amber-400',
  high: 'bg-orange-500',
  strict: 'bg-rose-500',
}

const ENF_TEXT: Record<Enforcement, string> = {
  none: 'text-emerald-300',
  low: 'text-lime-300',
  medium: 'text-amber-300',
  high: 'text-orange-300',
  strict: 'text-rose-300',
}

export function EnforcementMeter({ level, showLabel = true }: { level: Enforcement; showLabel?: boolean }) {
  const rank = ENFORCEMENT_RANK[level]
  return (
    <span className="inline-flex items-center gap-2" title={`Sharing enforcement: ${ENFORCEMENT_LABEL[level]}`}>
      <span className="flex items-end gap-0.5" aria-hidden>
        {[1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className={`w-1.5 rounded-sm ${i <= rank ? ENF_COLOR[level] : 'bg-white/10'}`}
            style={{ height: 4 + i * 3 }}
          />
        ))}
      </span>
      {showLabel && <span className={`text-xs font-medium ${ENF_TEXT[level]}`}>{ENFORCEMENT_LABEL[level]}</span>}
    </span>
  )
}

export function ServiceChip({ service, dim = false }: { service: Service; dim?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-white/10 px-2 py-0.5 text-xs ${dim ? 'opacity-50' : ''}`}
    >
      <span className="size-2 rounded-full" style={{ background: service.color }} />
      {service.name}
    </span>
  )
}

export function ServiceLogo({ service, size = 36 }: { service: Service; size?: number }) {
  const initials = service.name
    .replace(/[^A-Za-z0-9+ ]/g, '')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
  return (
    <span
      className="grid shrink-0 place-items-center rounded-xl font-bold text-white shadow-inner"
      style={{ width: size, height: size, background: service.color, fontSize: size * 0.36 }}
    >
      {initials}
    </span>
  )
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 text-sm">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-10 shrink-0 rounded-full transition ${checked ? 'bg-indigo-500' : 'bg-white/15'}`}
      >
        <span className={`absolute top-0.5 size-5 rounded-full bg-white transition-all ${checked ? 'left-[18px]' : 'left-0.5'}`} />
      </button>
      {label}
    </label>
  )
}

export function Avatar({ name, color }: { name: string; color: string }) {
  return (
    <span
      className="grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold text-white"
      style={{ background: color }}
      title={name}
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  )
}

const HOUSE_COLORS = ['#6366f1', '#14b8a6', '#f59e0b', '#ec4899', '#22c55e', '#0ea5e9', '#a855f7', '#ef4444']
export const houseColor = (index: number) => HOUSE_COLORS[index % HOUSE_COLORS.length]
