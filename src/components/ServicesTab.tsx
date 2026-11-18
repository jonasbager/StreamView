import { useState } from 'react'
import { DEAL_TIPS, PRESET_BUNDLES, PRICES_AS_OF, SERVICES } from '../data/catalog'
import { kr, uid } from '../lib/store'
import type { AppState, Bundle, Category, Service } from '../lib/types'
import { Card, EnforcementMeter, ServiceChip, ServiceLogo } from './ui'

interface Props {
  state: AppState
  setState: (fn: (s: AppState) => AppState) => void
  serviceById: Map<string, Service>
}

const CATEGORY_LABEL: Record<Category, string> = { video: 'Video', sport: 'Video & sport', music: 'Music', free: 'Free' }

export function ServicesTab({ state, setState, serviceById }: Props) {
  const [filter, setFilter] = useState<'all' | 'shareable' | 'strict'>('all')

  const setPrice = (id: string, value: string, original: number) =>
    setState((s) => {
      const priceOverrides = { ...s.priceOverrides }
      const n = Number(value)
      if (value === '' || Number.isNaN(n) || n === original) delete priceOverrides[id]
      else priceOverrides[id] = n
      return { ...s, priceOverrides }
    })

  const shown = SERVICES.filter((s) =>
    filter === 'all' ? true : filter === 'shareable' ? !s.sharing.householdOnly || s.sharing.enforcement === 'low' : ['high', 'strict'].includes(s.sharing.enforcement),
  )

  return (
    <div className="space-y-10">
      <section>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-white">Services & sharing rules</h2>
            <p className="text-sm text-slate-400">
              Danish prices per month, approximate as of {PRICES_AS_OF}. Click a price to correct it; your edits are used everywhere.
            </p>
          </div>
          <div className="flex rounded-xl border border-white/10 p-1 text-sm">
            {(
              [
                ['all', 'All'],
                ['shareable', 'Easy to share'],
                ['strict', 'Hard to share'],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setFilter(k)}
                className={`rounded-lg px-3 py-1 ${filter === k ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {shown.map((svc) => (
            <Card key={svc.id} className="flex flex-col p-5">
              <div className="flex items-start gap-3">
                <ServiceLogo service={svc} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <a href={svc.url} target="_blank" rel="noreferrer" className="font-semibold text-white hover:underline">
                      {svc.name}
                    </a>
                    <span className="text-xs text-slate-500">{CATEGORY_LABEL[svc.category]}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <EnforcementMeter level={svc.sharing.enforcement} />
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] ${
                        svc.sharing.householdOnly ? 'bg-white/5 text-slate-300' : 'bg-emerald-500/15 text-emerald-300'
                      }`}
                    >
                      {svc.sharing.householdOnly ? 'One household per subscription' : 'Can be shared across homes'}
                    </span>
                  </div>
                </div>
              </div>

              <table className="mt-4 w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500">
                    <th className="pb-1 font-normal">Plan</th>
                    <th className="pb-1 font-normal">{svc.capacityType === 'streams' ? 'Streams' : 'People'}</th>
                    <th className="pb-1 text-right font-normal">kr / month</th>
                  </tr>
                </thead>
                <tbody>
                  {svc.plans.map((p) => {
                    const overridden = state.priceOverrides[p.id] !== undefined
                    return (
                      <tr key={p.id} className="border-t border-white/5">
                        <td className="py-1.5">
                          {p.name}
                          {p.ads && <span className="ml-1.5 rounded bg-white/8 px-1 text-[10px] text-slate-400">ADS</span>}
                          {p.extraMember && (
                            <span className="ml-1.5 rounded bg-indigo-500/15 px-1 text-[10px] text-indigo-300">
                              +{p.extraMember.slots} extra member
                            </span>
                          )}
                          {p.annualPrice && (
                            <span className="ml-1.5 text-[10px] text-slate-500">{kr(p.annualPrice)}/yr</span>
                          )}
                        </td>
                        <td className="py-1.5 text-slate-400">{p.capacity >= 99 ? '∞' : p.capacity}</td>
                        <td className="py-1.5 text-right">
                          <input
                            type="number"
                            min={0}
                            value={state.priceOverrides[p.id] ?? p.price}
                            onChange={(e) => setPrice(p.id, e.target.value, p.price)}
                            className={`w-20 rounded-md border bg-transparent px-2 py-0.5 text-right outline-none focus:border-indigo-400 ${
                              overridden ? 'border-indigo-400/50 text-indigo-200' : 'border-transparent hover:border-white/15'
                            }`}
                            aria-label={`${svc.name} ${p.name} price`}
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <div className="rounded-xl bg-emerald-500/[0.06] p-3">
                  <div className="mb-1 text-xs font-semibold tracking-wide text-emerald-300 uppercase">The legal way</div>
                  <p className="text-slate-300">{svc.sharing.officialSharing}</p>
                </div>
                <div className="rounded-xl bg-amber-500/[0.06] p-3">
                  <div className="mb-1 text-xs font-semibold tracking-wide text-amber-300 uppercase">If you share anyway</div>
                  <p className="text-slate-300">{svc.sharing.howEnforced}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <DealsSection state={state} setState={setState} serviceById={serviceById} />

      <section>
        <h2 className="mb-3 text-lg font-semibold text-white">More ways to save</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {DEAL_TIPS.map((t) => (
            <Card key={t.title} className="p-4">
              <div className="font-medium text-white">{t.title}</div>
              <p className="mt-1 text-sm text-slate-400">{t.body}</p>
            </Card>
          ))}
        </div>
      </section>
    </div>
  )
}

function DealsSection({ state, setState, serviceById }: Props) {
  const [draft, setDraft] = useState<Bundle | null>(null)

  const all = [...PRESET_BUNDLES, ...state.customDeals]

  const toggleHidden = (id: string) =>
    setState((s) => ({
      ...s,
      hiddenBundles: s.hiddenBundles.includes(id) ? s.hiddenBundles.filter((x) => x !== id) : [...s.hiddenBundles, id],
    }))

  const saveDraft = () => {
    if (!draft || !draft.name.trim() || draft.includes.length === 0) return
    setState((s) => {
      const exists = s.customDeals.some((d) => d.id === draft.id)
      return {
        ...s,
        customDeals: exists ? s.customDeals.map((d) => (d.id === draft.id ? draft : d)) : [...s.customDeals, draft],
      }
    })
    setDraft(null)
  }

  return (
    <section>
      <div className="mb-3 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Bundles & your deals</h2>
          <p className="text-sm text-slate-400">
            Add telco packages, mobile plans with streaming included, or a discount you've been offered. The optimiser will use them.
          </p>
        </div>
        <button
          className="btn-primary shrink-0"
          onClick={() =>
            setDraft({ id: uid(), name: '', provider: '', price: 0, ads: false, includes: [], custom: true })
          }
        >
          + Add deal
        </button>
      </div>

      {draft && (
        <Card className="mb-4 space-y-4 border-indigo-400/30 p-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-sm">
              <span className="text-slate-400">Name</span>
              <input
                autoFocus
                className="field"
                placeholder="e.g. Telmore Play"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </label>
            <label className="text-sm">
              <span className="text-slate-400">Provider</span>
              <input
                className="field"
                placeholder="e.g. Telmore"
                value={draft.provider}
                onChange={(e) => setDraft({ ...draft, provider: e.target.value })}
              />
            </label>
            <label className="text-sm">
              <span className="text-slate-400">Price per month (kr)</span>
              <input
                type="number"
                min={0}
                className="field"
                value={draft.price}
                onChange={(e) => setDraft({ ...draft, price: Number(e.target.value) })}
              />
            </label>
          </div>
          <div>
            <div className="mb-2 text-sm text-slate-400">Included services (and how many streams or people each)</div>
            <div className="flex flex-wrap gap-2">
              {SERVICES.filter((s) => s.category !== 'free').map((s) => {
                const item = draft.includes.find((i) => i.serviceId === s.id)
                return (
                  <div
                    key={s.id}
                    className={`flex items-center gap-1 rounded-xl border px-2 py-1 text-sm ${item ? 'border-indigo-400/50 bg-indigo-500/10' : 'border-white/10'}`}
                  >
                    <button
                      onClick={() =>
                        setDraft({
                          ...draft,
                          includes: item
                            ? draft.includes.filter((i) => i.serviceId !== s.id)
                            : [...draft.includes, { serviceId: s.id, capacity: s.capacityType === 'seats' ? 1 : 2 }],
                        })
                      }
                    >
                      {s.name}
                    </button>
                    {item && (
                      <input
                        type="number"
                        min={1}
                        value={item.capacity}
                        title={s.capacityType === 'streams' ? 'Simultaneous streams' : 'People'}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            includes: draft.includes.map((i) =>
                              i.serviceId === s.id ? { ...i, capacity: Math.max(1, Number(e.target.value)) } : i,
                            ),
                          })
                        }
                        className="w-10 rounded bg-black/30 px-1 text-center text-xs"
                      />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" checked={draft.ads} onChange={(e) => setDraft({ ...draft, ads: e.target.checked })} />
            Includes ad-supported tiers
          </label>
          <div className="flex gap-2">
            <button className="btn-primary" onClick={saveDraft} disabled={!draft.name.trim() || draft.includes.length === 0}>
              Save deal
            </button>
            <button className="btn-ghost" onClick={() => setDraft(null)}>
              Cancel
            </button>
          </div>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {all.map((b) => {
          const hidden = state.hiddenBundles.includes(b.id)
          const separate = b.includes.reduce((sum, i) => {
            const svc = serviceById.get(i.serviceId)
            if (!svc) return sum
            const plan = [...svc.plans].sort((a, c) => a.price - c.price).find((p) => p.capacity >= i.capacity) ?? svc.plans.at(-1)!
            return sum + (state.priceOverrides[plan.id] ?? plan.price)
          }, 0)
          const price = state.priceOverrides[b.id] ?? b.price
          return (
            <Card key={b.id} className={`p-4 ${hidden ? 'opacity-50' : ''}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-medium text-white">{b.name}</div>
                  <div className="text-xs text-slate-500">
                    {b.provider}
                    {b.custom && ' · your deal'}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-white">{kr(price)}</div>
                  {separate > price && <div className="text-xs text-emerald-300">saves {kr(separate - price)}</div>}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {b.includes.map((i) => {
                  const s = serviceById.get(i.serviceId)
                  return s ? <ServiceChip key={i.serviceId} service={s} /> : null
                })}
              </div>
              {b.note && <p className="mt-2 text-xs text-slate-400">{b.note}</p>}
              <div className="mt-3 flex gap-3 text-xs">
                {b.custom ? (
                  <>
                    <button className="text-indigo-300 hover:underline" onClick={() => setDraft(b)}>
                      Edit
                    </button>
                    <button
                      className="text-slate-500 hover:text-rose-300"
                      onClick={() => setState((s) => ({ ...s, customDeals: s.customDeals.filter((d) => d.id !== b.id) }))}
                    >
                      Delete
                    </button>
                  </>
                ) : (
                  <button className="text-slate-400 hover:text-white" onClick={() => toggleHidden(b.id)}>
                    {hidden ? 'Include in optimiser' : "Don't use this"}
                  </button>
                )}
              </div>
            </Card>
          )
        })}
      </div>
    </section>
  )
}
