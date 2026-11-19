'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { BrandMark } from '@/components/BrandMark'
import { Person, personColor, RiskPill } from '@/components/ui'
import type { Enforcement, FamilySettings } from '@/db/schema'
import { bestForBudget, Catalog, currentSpend, evaluate, frontier, optimise, wishes, type Ctx, type FrontierPoint } from '@/lib/engine'
import { kr } from '@/lib/format'
import { explainBoard, saveSettings, openBoard } from './actions'
import { FrontierChart } from './FrontierChart'

const TOLERANCE: { v: Enforcement; label: string; hint: string }[] = [
  { v: 'none', label: 'Nej', hint: 'Kun det tjenesterne tillader' },
  { v: 'low', label: 'Hvor ingen tjekker', hint: 'Fx TV 2 Play, SkyShowtime, Prime Video' },
  { v: 'medium', label: 'Lidt risiko', hint: '+ Spotify, HBO Max, Viaplay' },
  { v: 'high', label: 'Mere risiko', hint: '+ Disney+, YouTube Premium' },
  { v: 'strict', label: 'Alt', hint: '+ Netflix, der blokerer andre hjem' },
]

type Explained = Awaited<ReturnType<typeof explainBoard>>

export function BudgetExplorer({ ctx, initial }: { ctx: Ctx; initial: FamilySettings }) {
  const cat = useMemo(() => new Catalog(ctx), [ctx])
  const current = useMemo(() => currentSpend(cat), [cat])
  const w = useMemo(() => wishes(cat), [cat])
  const [s, setS] = useState<FamilySettings>(initial)
  const [explained, setExplained] = useState<{ key: string; data: Explained } | null>(null)
  const [explaining, startExplain] = useTransition()
  const [opening, startOpen] = useTransition()
  const first = useRef(true)

  const opts = { adsOk: s.adsOk, allowBinding: s.allowBinding, switchTelco: s.switchTelco }
  const mode: 'legal' | 'bend' = s.tolerance === 'none' ? 'legal' : 'bend'
  const pts = useMemo(() => frontier(cat, { mode, tolerance: s.tolerance === 'none' ? 'high' : s.tolerance, opts }), [cat, s.tolerance, s.adsOk, s.allowBinding, s.switchTelco]) // eslint-disable-line react-hooks/exhaustive-deps
  const legalPts = useMemo(() => (mode === 'legal' ? pts : frontier(cat, { mode: 'legal', tolerance: 'high', opts })), [cat, mode, pts, s.adsOk, s.allowBinding, s.switchTelco]) // eslint-disable-line react-hooks/exhaustive-deps

  const budget = s.budget ?? Math.round(current || pts[0]?.monthly || 0)
  const input = { mode, tolerance: s.tolerance === 'none' ? ('high' as const) : s.tolerance, opts }
  const pick = useMemo(() => bestForBudget(cat, input, budget, pts), [cat, pts, budget]) // eslint-disable-line react-hooks/exhaustive-deps
  const result = useMemo(() => evaluate(cat, pick.board), [cat, pick])
  const total = w.size
  const telcoCost = result.packages.flatMap((p) => p.items).filter((i) => i.category === 'mobile' || i.category === 'broadband' || i.category === 'tv').reduce((n, i) => n + i.monthly, 0)
  const over = pick.monthly > budget + 0.5

  // What each lever is worth at this budget.
  const levers = useMemo(() => {
    const at = (patch: Partial<FamilySettings>) => {
      const t = { ...s, ...patch }
      return bestForBudget(
        cat,
        { mode: t.tolerance === 'none' ? 'legal' : 'bend', tolerance: t.tolerance === 'none' ? 'high' : t.tolerance, opts: { adsOk: t.adsOk, allowBinding: t.allowBinding, switchTelco: t.switchTelco } },
        budget,
      )
    }
    const impact = (p: FrontierPoint) => ({ services: p.services.length - pick.services.length, monthly: p.monthly - pick.monthly })
    return {
      adsOk: impact(at({ adsOk: !s.adsOk })),
      allowBinding: impact(at({ allowBinding: !s.allowBinding })),
      switchTelco: impact(at({ switchTelco: !s.switchTelco })),
      tolerance: Object.fromEntries(TOLERANCE.map((t) => [t.v, impact(at({ tolerance: t.v }))])) as Record<Enforcement, ReturnType<typeof impact>>,
    }
  }, [cat, s, budget, pick]) // eslint-disable-line react-hooks/exhaustive-deps

  // Extra cost to add one left-out service back.
  const addCost = useMemo(() => {
    const out = new Map<string, number>()
    for (const sid of pick.dropped) {
      const ex = new Set(pick.dropped.filter((d) => d !== sid))
      const b = optimise(cat, mode, s.tolerance === 'none' ? 'high' : s.tolerance, { ...opts, exclude: ex })
      out.set(sid, evaluate(cat, b).monthly - pick.monthly)
    }
    return out
  }, [cat, pick]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    const t = setTimeout(() => saveSettings(s).catch(() => {}), 600)
    return () => clearTimeout(t)
  }, [s])

  const set = (patch: Partial<FamilySettings>) => setS((x) => ({ ...x, ...patch }))
  const sliderMax = Math.ceil(Math.max(current, pts[0]?.monthly ?? 0, budget) * 1.15 / 50) * 50
  const sliderMin = Math.floor((pts[pts.length - 1]?.monthly ?? 0) * 0.9 / 50) * 50
  const pickKey = `${pick.monthly}:${pick.services.join(',')}:${s.tolerance}`
  const memberIdx = new Map(ctx.members.map((m, i) => [m.id, i]))
  const sorted = [...w.entries()].sort((a, b) => Number(pick.dropped.includes(a[0])) - Number(pick.dropped.includes(b[0])) || b[1].weight - a[1].weight)

  if (total === 0) {
    return (
      <div className="card p-8 text-center text-ink-2">
        Ingen har valgt nogen tjenester endnu. Når I har sagt, hvad I gerne vil have, viser vi her, hvor meget I kan få for jeres budget.
      </div>
    )
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-6">
        <section className="card p-6">
          <div className="eyebrow">Jeres budget pr. måned · alt inkl. mobil og internet</div>
          <div className="mt-2 flex flex-wrap items-end gap-x-6 gap-y-3">
            <label className="flex items-baseline gap-2">
              <input
                type="number"
                inputMode="numeric"
                min={0}
                step={10}
                value={budget}
                onChange={(e) => set({ budget: e.target.value === '' ? null : Number(e.target.value) })}
                className="num w-40 rounded-xl border border-line-2 bg-card px-3 py-1 text-4xl font-semibold tracking-tight outline-none focus:border-ink"
                aria-label="Budget i kroner pr. måned"
              />
              <span className="text-xl text-ink-2">kr.</span>
            </label>
            <div className="pb-2 text-sm text-ink-2">
              I dag betaler I <b className="num text-ink">{kr(current)}</b>
              {s.budget != null && Math.round(s.budget) !== Math.round(current) && (
                <button className="ml-2 underline hover:text-ink" onClick={() => set({ budget: null })}>brug det</button>
              )}
            </div>
          </div>
          <input
            type="range"
            min={sliderMin}
            max={sliderMax}
            step={10}
            value={Math.min(Math.max(budget, sliderMin), sliderMax)}
            onChange={(e) => set({ budget: Number(e.target.value) })}
            className="mt-4 w-full accent-[var(--color-brand)]"
            aria-label="Budget"
          />

          <div className="mt-6 border-t border-line pt-6">
            <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
              {over ? (
                <>Jeres &quot;skal have&quot; koster <span className="num">{kr(pick.monthly)}</span>, mere end budgettet.</>
              ) : (
                <>
                  I kan få <span className="num text-brand">{pick.services.length} af {total}</span> ønskede tjenester
                  <span className="text-ink-2"> for </span>
                  <span className="num">{kr(pick.monthly)}</span>
                </>
              )}
            </h2>
            <p className="mt-1 text-ink-2">
              {telcoCost > 0 && <>Heraf {kr(telcoCost)} til mobil, internet og TV. </>}
              {current > 0 && pick.monthly < current && <>Det er {kr(current - pick.monthly)} mindre end i dag. </>}
              {result.maxRisk !== 'none' && <>Nogle logins deles på tværs af hjem.</>}
            </p>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-sunk" aria-hidden>
              <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${(pick.services.length / total) * 100}%` }} />
            </div>
          </div>

          <ul className="mt-6 grid gap-2 sm:grid-cols-2">
            {sorted.map(([sid, info]) => {
              const svc = cat.service.get(sid)!
              const out = pick.dropped.includes(sid)
              return (
                <li key={sid} className={`flex items-center gap-3 rounded-2xl border px-3 py-2.5 ${out ? 'border-dashed border-line-2 bg-transparent' : 'border-line bg-card'}`}>
                  <span className={out ? 'opacity-40 grayscale' : ''}>
                    <BrandMark id={sid} name={svc.name} color={svc.color} size={30} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className={`truncate text-[15px] font-medium ${out ? 'text-ink-3' : ''}`}>
                      {svc.name}
                      {info.must && <span className="ml-1.5 rounded-full bg-sunk px-1.5 py-0.5 text-[11px] font-medium text-ink-2">Skal have</span>}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-ink-3">
                      <span className="flex -space-x-1">
                        {info.people.slice(0, 4).map((pid) => {
                          const m = ctx.members.find((x) => x.id === pid)
                          return m ? <Person key={pid} name={m.name} color={personColor(memberIdx.get(pid) ?? 0)} size={16} /> : null
                        })}
                      </span>
                      {info.people.length} {info.people.length === 1 ? 'ønsker' : 'ønsker'}
                    </div>
                  </div>
                  {out ? (
                    <button
                      className="text-sm whitespace-nowrap text-ink-2 hover:text-ink"
                      title="Hæv budgettet så denne kommer med"
                      onClick={() => set({ budget: Math.ceil((pick.monthly + (addCost.get(sid) ?? 0)) / 10) * 10 })}
                    >
                      + {kr(addCost.get(sid) ?? 0)}
                    </button>
                  ) : (
                    <span className="text-sm text-brand" aria-label="Med">✓</span>
                  )}
                </li>
              )
            })}
          </ul>
        </section>

        <section className="card p-6">
          <h3 className="font-semibold">Hvad får I for pengene?</h3>
          <p className="mb-4 text-sm text-ink-2">Hver trappe er den billigste måde at få så mange ønsker opfyldt. Klik i grafen for at vælge et budget.</p>
          <FrontierChart
            series={[
              { key: 'legal', label: 'Efter reglerne', points: legalPts },
              ...(mode === 'bend' ? [{ key: 'flex' as const, label: 'Med deling', points: pts }] : []),
            ]}
            budget={budget}
            total={total}
            onPick={(b) => set({ budget: b })}
          />
        </section>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
        <section className="card p-5">
          <h3 className="font-semibold">Hvor fleksible vil I være?</h3>
          <p className="mb-4 text-sm text-ink-2">Tallene viser, hvad hver ting betyder ved jeres budget.</p>
          <div className="divide-y divide-line">
            <Lever label="Reklamer er okay" checked={s.adsOk} onChange={(v) => set({ adsOk: v })} impact={levers.adsOk} />
            <Lever label="Binding er okay" sub="Fx 6 måneder mod lavere pris" checked={s.allowBinding} onChange={(v) => set({ allowBinding: v })} impact={levers.allowBinding} />
            <Lever label="Skift mobil og internet" sub="Når det frigør penge. Respekterer dem, der har sagt nej." checked={s.switchTelco} onChange={(v) => set({ switchTelco: v })} impact={levers.switchTelco} />
          </div>
          <div className="mt-4 border-t border-line pt-4">
            <div className="font-medium">Del logins med familien i andre hjem</div>
            <div className="mb-3 text-sm text-ink-2">Ikke ulovligt, men ofte imod vilkårene.</div>
            <div className="space-y-1.5">
              {TOLERANCE.map((t) => {
                const imp = levers.tolerance[t.v]
                const on = s.tolerance === t.v
                return (
                  <button
                    key={t.v}
                    onClick={() => set({ tolerance: t.v })}
                    className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition ${on ? 'border-ink bg-sunk' : 'border-line hover:border-line-2'}`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">{t.label}</span>
                      <span className="block truncate text-xs text-ink-3">{t.hint}</span>
                    </span>
                    {!on && <ImpactTag impact={imp} />}
                  </button>
                )
              })}
            </div>
          </div>
        </section>

        <section className="card p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="num text-2xl font-semibold tracking-tight">{kr(pick.monthly)}</div>
              <div className="text-sm text-ink-3">{result.packages.length} pakker · første år {kr(result.firstYear)}</div>
            </div>
            {result.maxRisk !== 'none' ? <RiskPill level={result.maxRisk} /> : <RiskPill level="none" label="Efter reglerne" />}
          </div>
          <button className="btn-primary mt-4 w-full" disabled={opening} onClick={() => startOpen(() => openBoard({ packages: pick.board }))}>
            {opening ? 'Åbner…' : 'Brug som opsætning'}
          </button>
          <button
            className="btn-quiet mt-2 w-full"
            disabled={explaining}
            onClick={() =>
              startExplain(async () => {
                try {
                  setExplained({ key: pickKey, data: await explainBoard({ packages: pick.board }, mode) })
                } catch {
                  setExplained(null)
                }
              })
            }
          >
            {explaining ? 'AI skriver…' : 'Hvad skal vi gøre? Spørg AI'}
          </button>
          {explained && explained.key === pickKey && (
            <div className="mt-4 border-t border-line pt-4 text-[15px]">
              <p className="font-medium">{explained.data.headline}</p>
              <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-ink-2">
                {explained.data.steps.map((t) => <li key={t}>{t}</li>)}
              </ol>
              {explained.data.caveats.length > 0 && (
                <ul className="mt-3 space-y-1 text-sm text-warn">
                  {explained.data.caveats.map((t) => <li key={t}>{t}</li>)}
                </ul>
              )}
            </div>
          )}
        </section>
      </aside>
    </div>
  )
}

function ImpactTag({ impact }: { impact: { services: number; monthly: number } }) {
  if (impact.services > 0) return <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-medium whitespace-nowrap text-brand">+{impact.services} tjenester</span>
  if (impact.services < 0) return <span className="rounded-full bg-sunk px-2 py-0.5 text-xs font-medium whitespace-nowrap text-ink-2">{impact.services} tjenester</span>
  if (impact.monthly < -1) return <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-medium whitespace-nowrap text-brand">−{kr(-impact.monthly)}</span>
  if (impact.monthly > 1) return <span className="rounded-full bg-sunk px-2 py-0.5 text-xs font-medium whitespace-nowrap text-ink-2">+{kr(impact.monthly)}</span>
  return <span className="text-xs text-ink-3">Ingen forskel</span>
}

function Lever({ label, sub, checked, onChange, impact }: { label: string; sub?: string; checked: boolean; onChange: (v: boolean) => void; impact: { services: number; monthly: number } }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 py-3">
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{label}</span>
        {sub && <span className="block text-xs text-ink-3">{sub}</span>}
        <span className="mt-1 block">
          <span className="text-xs text-ink-3">{checked ? 'Slå fra: ' : 'Slå til: '}</span>
          <ImpactTag impact={impact} />
        </span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-10 shrink-0 rounded-full transition ${checked ? 'bg-brand' : 'bg-line-2'}`}
      >
        <span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-all ${checked ? 'left-[18px]' : 'left-0.5'}`} />
      </button>
    </label>
  )
}

