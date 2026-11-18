import { useMemo, useState } from 'react'
import { computeScenario, type Catalog, type Purchase, type Scenario } from '../lib/optimizer'
import { kr } from '../lib/store'
import type { AppState, Enforcement, Settings } from '../lib/types'
import { ENFORCEMENT_LABEL } from '../lib/types'
import { Avatar, Card, EnforcementMeter, houseColor, ServiceChip, Toggle } from './ui'

interface Props {
  state: AppState
  setState: (fn: (s: AppState) => AppState) => void
  catalog: Catalog
}

const TOLERANCE_STEPS: Settings['riskTolerance'][] = ['low', 'medium', 'high', 'strict']

export function PlanTab({ state, setState, catalog }: Props) {
  const [view, setView] = useState<'legal' | 'bend'>('legal')
  const setSettings = (patch: Partial<Settings>) => setState((s) => ({ ...s, settings: { ...s.settings, ...patch } }))

  const scenarios = useMemo(
    () => ({
      individual: computeScenario({ state, catalog, mode: 'individual' }),
      legal: computeScenario({ state, catalog, mode: 'legal' }),
      bend: computeScenario({ state, catalog, mode: 'bend' }),
    }),
    [state, catalog],
  )

  const { settings, members, households } = state
  const active = scenarios[view]

  if (members.length === 0) {
    return (
      <Card className="p-10 text-center text-slate-400">
        Add your family on the <b className="text-white">Family</b> tab to get a plan.
      </Card>
    )
  }

  const savedLegal = scenarios.individual.total - scenarios.legal.total
  const extraBend = scenarios.legal.total - scenarios.bend.total

  return (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-3">
        <SummaryCard
          title="Everyone pays for their own"
          subtitle="No sharing at all: the worst case"
          total={scenarios.individual.total}
          tone="muted"
        />
        <SummaryCard
          title="Smart & by the rules"
          subtitle={savedLegal > 0 ? `Saves ${kr(savedLegal)}/month with family plans, bundles and extra members` : 'Family plans, bundles and extra members'}
          total={scenarios.legal.total}
          tone="legal"
          active={view === 'legal'}
          onClick={() => setView('legal')}
        />
        <SummaryCard
          title="Bending the rules"
          subtitle={
            extraBend > 0
              ? `${kr(extraBend)}/month less by also sharing across homes, up to "${ENFORCEMENT_LABEL[settings.riskTolerance].toLowerCase()}" services`
              : 'No further savings at this risk level'
          }
          total={scenarios.bend.total}
          tone="bend"
          active={view === 'bend'}
          onClick={() => setView('bend')}
        />
      </div>

      <Card className="grid gap-5 p-5 md:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="text-slate-300">How far are you willing to bend the rules?</span>
            <EnforcementMeter level={settings.riskTolerance} showLabel={false} />
          </div>
          <input
            type="range"
            min={0}
            max={3}
            value={TOLERANCE_STEPS.indexOf(settings.riskTolerance)}
            onChange={(e) => setSettings({ riskTolerance: TOLERANCE_STEPS[Number(e.target.value)] })}
            className="w-full accent-amber-400"
            aria-label="Risk tolerance"
          />
          <div className="mt-1 grid grid-cols-4 text-[11px] text-slate-500">
            {TOLERANCE_STEPS.map((t) => (
              <span key={t} className={`${t === settings.riskTolerance ? 'text-amber-300' : ''} first:text-left last:text-right text-center`}>
                {ENFORCEMENT_LABEL[t]}
              </span>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Only affects the "bending the rules" plan. It shares a service across homes only if that service's enforcement is at or below this level.
          </p>
        </div>
        <div>
          <div className="mb-1 flex justify-between text-sm text-slate-300">
            <span>Watching at the same time</span>
            <span className="text-slate-400">{Math.round(settings.concurrency * 100)}%</span>
          </div>
          <input
            type="range"
            min={0.2}
            max={1}
            step={0.05}
            value={settings.concurrency}
            onChange={(e) => setSettings({ concurrency: Number(e.target.value) })}
            className="w-full accent-indigo-400"
            aria-label="Share of people watching simultaneously"
          />
          <p className="mt-1 text-xs text-slate-500">This decides how many simultaneous streams a shared video account needs.</p>
        </div>
        <div className="space-y-3">
          <Toggle checked={settings.allowAds} onChange={(v) => setSettings({ allowAds: v })} label="Ads are OK" />
          <Toggle checked={settings.annualBilling} onChange={(v) => setSettings({ annualBilling: v })} label="Annual billing where cheaper" />
        </div>
      </Card>

      <div className="flex items-center gap-1 rounded-xl border border-white/10 p-1 text-sm sm:w-fit">
        <button
          onClick={() => setView('legal')}
          className={`flex-1 rounded-lg px-4 py-1.5 whitespace-nowrap ${view === 'legal' ? 'bg-emerald-500/15 text-emerald-200' : 'text-slate-400'}`}
        >
          ✓ By the rules
        </button>
        <button
          onClick={() => setView('bend')}
          className={`flex-1 rounded-lg px-4 py-1.5 whitespace-nowrap ${view === 'bend' ? 'bg-amber-500/15 text-amber-200' : 'text-slate-400'}`}
        >
          ⚠ Bending the rules
        </button>
      </div>

      {view === 'bend' && (
        <div className="rounded-xl border border-amber-400/20 bg-amber-500/[0.06] p-4 text-sm text-amber-100/90">
          Sharing a login outside your household isn't piracy, but it breaks most services' terms of use. The worst realistic outcome
          is that the service blocks the other home, asks them to verify or pay, or (rarely) closes the account. The bars show how
          hard each service clamps down.
        </div>
      )}

      <ScenarioView scenario={active} state={state} catalog={catalog} mode={view} />

      <PerPerson scenario={active} state={state} />

      <p className="text-xs text-slate-500">
        Prices are approximate and change often. Check the service before you subscribe. Correct any price on the Services tab.
        {households.length > 1 && ' "Who pays" is the household with most users on that subscription. Split the cost however you like.'}
      </p>
    </div>
  )
}

function SummaryCard({
  title,
  subtitle,
  total,
  tone,
  active,
  onClick,
}: {
  title: string
  subtitle: string
  total: number
  tone: 'muted' | 'legal' | 'bend'
  active?: boolean
  onClick?: () => void
}) {
  const ring =
    tone === 'legal' ? 'ring-emerald-400/50' : tone === 'bend' ? 'ring-amber-400/50' : ''
  const accent = tone === 'legal' ? 'text-emerald-300' : tone === 'bend' ? 'text-amber-300' : 'text-slate-400'
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      onClick={onClick}
      className={`rounded-2xl border border-white/8 bg-white/[0.03] p-5 text-left transition ${onClick ? 'hover:bg-white/[0.05]' : ''} ${
        active ? `ring-2 ${ring}` : ''
      }`}
    >
      <div className={`text-xs font-semibold tracking-wide uppercase ${accent}`}>{title}</div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className={`text-3xl font-bold tabular-nums ${tone === 'muted' ? 'text-slate-400 line-through decoration-1' : 'text-white'}`}>
          {kr(total)}
        </span>
        <span className="text-sm text-slate-500">/ month</span>
      </div>
      <div className="mt-1 text-xs text-slate-400">{kr(total * 12)} per year</div>
      <div className="mt-2 text-sm text-slate-400">{subtitle}</div>
    </Tag>
  )
}

function ScenarioView({ scenario, state, catalog, mode }: { scenario: Scenario; state: AppState; catalog: Catalog; mode: 'legal' | 'bend' }) {
  const memberById = new Map(state.members.map((m) => [m.id, m]))
  const hIndex = new Map(state.households.map((h, i) => [h.id, i]))

  const byHousehold = state.households
    .map((h) => ({ household: h, purchases: scenario.purchases.filter((p) => p.payerHouseholdId === h.id) }))
    .filter((g) => g.purchases.length)

  return (
    <div className="space-y-4">
      {scenario.uncovered.length > 0 && (
        <div className="rounded-xl border border-rose-400/20 bg-rose-500/[0.06] p-3 text-sm text-rose-200">
          Couldn't cover:{' '}
          {scenario.uncovered
            .map((u) => `${memberById.get(u.memberId)?.name} → ${catalog.serviceById.get(u.serviceId)?.name}`)
            .join(', ')}
          . Try allowing ad tiers.
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        {byHousehold.map(({ household, purchases }) => (
          <Card key={household.id} className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="size-3 rounded-full" style={{ background: houseColor(hIndex.get(household.id) ?? 0) }} />
                <h3 className="font-semibold text-white">{household.name} pays for</h3>
              </div>
              <span className="font-semibold text-white tabular-nums">{kr(scenario.perHousehold[household.id] ?? 0)}</span>
            </div>
            <ul className="space-y-3">
              {purchases.map((p) => (
                <PurchaseRow key={p.key} p={p} state={state} catalog={catalog} mode={mode} />
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </div>
  )
}

function PurchaseRow({ p, state, catalog, mode }: { p: Purchase; state: AppState; catalog: Catalog; mode: 'legal' | 'bend' }) {
  const memberById = new Map(state.members.map((m) => [m.id, m]))
  const hIndex = new Map(state.households.map((h, i) => [h.id, i]))
  const otherHomes = [...new Set(p.users.map((u) => memberById.get(u)!.householdId))].filter((h) => h !== p.payerHouseholdId)

  const officialCrossHome = !p.breaksRules && otherHomes.length > 0 && p.monthly > 0
  return (
    <li className={`rounded-xl border p-3 ${p.breaksRules ? 'border-amber-400/25 bg-amber-500/[0.04]' : 'border-white/6 bg-white/[0.02]'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-medium text-white">
            {p.name}
            {p.copies > 1 && p.kind !== 'extra-member' && <span className="ml-1 text-slate-400">× {p.copies}</span>}
          </div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {p.kind === 'bundle' &&
              p.services.map((sid) => {
                const s = catalog.serviceById.get(sid)
                return s ? <ServiceChip key={sid} service={s} /> : null
              })}
            {p.kind === 'extra-member' && (
              <span className="rounded-full bg-indigo-500/15 px-2 py-0.5 text-xs text-indigo-300">Official extra member</span>
            )}
            {officialCrossHome && (
              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-300">Shared across homes: allowed</span>
            )}
            {p.note && <span className="text-xs text-slate-500">{p.note}</span>}
          </div>
        </div>
        <div className="shrink-0 text-right font-semibold text-white tabular-nums">{kr(p.monthly)}</div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1">
        {p.users.map((u) => {
          const m = memberById.get(u)!
          return (
            <span key={u} className="inline-flex items-center gap-1 rounded-full bg-white/5 py-0.5 pr-2 pl-0.5 text-xs">
              <Avatar name={m.name} color={houseColor(hIndex.get(m.householdId) ?? 0)} />
              {m.name}
            </span>
          )
        })}
        {p.users.length > 1 && <span className="ml-1 text-xs text-slate-500">≈ {kr(p.monthly / p.users.length)} each</span>}
      </div>

      {p.breaksRules && mode === 'bend' && (
        <div className="mt-2 border-t border-amber-400/15 pt-2 text-xs">
          <div className="flex items-center gap-2">
            <EnforcementMeter level={p.risk} />
            <span className="text-slate-400">
              shared with {otherHomes.map((h) => state.households.find((x) => x.id === h)?.name).join(', ')}
            </span>
          </div>
          {p.riskyServices.map((sid) => {
            const s = catalog.serviceById.get(sid)!
            return (
              <p key={sid} className="mt-1 text-slate-400">
                <span className="text-slate-300">{s.name}:</span> {riskAdvice(s.sharing.enforcement)}
              </p>
            )
          })}
        </div>
      )}
    </li>
  )
}

function riskAdvice(e: Enforcement): string {
  switch (e) {
    case 'low':
      return "No known household checks. It usually works as long as you stay within the stream limit."
    case 'medium':
      return 'Occasional checks or warnings. It usually works, but expect the odd verification prompt.'
    case 'high':
      return 'Active location checks. Expect the other home to be asked to verify, pay for an extra member, or get blocked.'
    case 'strict':
      return "Tied to your home Wi‑Fi. The other home will very likely be blocked within weeks. Usually not worth it; consider the official extra member instead."
    default:
      return ''
  }
}

function PerPerson({ scenario, state }: { scenario: Scenario; state: AppState }) {
  const hIndex = new Map(state.households.map((h, i) => [h.id, i]))
  const max = Math.max(1, ...Object.values(scenario.perMember))
  return (
    <Card className="p-5">
      <h3 className="mb-1 font-semibold text-white">Fair split per person</h3>
      <p className="mb-4 text-sm text-slate-400">Each subscription's price split evenly between the people who use it.</p>
      <div className="space-y-2">
        {state.members.map((m) => {
          const v = scenario.perMember[m.id] ?? 0
          return (
            <div key={m.id} className="flex items-center gap-3 text-sm">
              <Avatar name={m.name} color={houseColor(hIndex.get(m.householdId) ?? 0)} />
              <span className="w-24 truncate text-slate-300">{m.name}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/5">
                <div className="h-full rounded-full bg-indigo-400/70" style={{ width: `${(v / max) * 100}%` }} />
              </div>
              <span className="w-20 text-right font-medium text-white tabular-nums">{kr(v)}</span>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
