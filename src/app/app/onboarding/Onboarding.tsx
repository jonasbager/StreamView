'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { BrandMark } from '@/components/BrandMark'
import type { Answers, CurrentBill, PaidService, PaidVia } from '@/db/schema'
import { saveAnswers } from '../actions'

interface Props {
  memberId: string | null
  initialName: string
  forSomeoneElse: boolean
  initial: Answers | null
  services: { id: string; name: string; color: string; category: string }[]
  telcos: { id: string; name: string; offers: ('mobile' | 'broadband' | 'tv')[] }[]
  plans: Record<string, { id: string; name: string; price: number }[]>
}

const STEPS = ['Har i dag', 'Ønsker', 'Mobil & internet', 'Skifte?']

const GROUPS: { category: string; label: string }[] = [
  { category: 'video', label: 'Film & serier' },
  { category: 'sport', label: 'Sport' },
  { category: 'music', label: 'Musik' },
  { category: 'audio', label: 'Lydbøger & podcasts' },
  { category: 'free', label: 'Gratis' },
]
const grouped = <T extends { category: string }>(list: T[]) =>
  GROUPS.map((g) => ({ ...g, items: list.filter((x) => x.category === g.category) })).filter((g) => g.items.length)

const empty: Answers = {
  paysFor: [],
  wants: [],
  mustHave: [],
  mobile: null,
  broadband: null,
  tv: null,
  willingToSwitch: 'if-worth-it',
  dataNeed: 'mid',
  adsOk: true,
  student: false,
}

export function Onboarding({ memberId, initialName, forSomeoneElse, initial, services, telcos, plans }: Props) {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [name, setName] = useState(initialName)
  const [a, setA] = useState<Answers>(initial ?? empty)
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const set = (patch: Partial<Answers>) => setA((x) => ({ ...x, ...patch }))

  const pays = (id: string) => a.paysFor.find((p) => p.serviceId === id)
  const togglePays = (id: string) => {
    if (pays(id)) set({ paysFor: a.paysFor.filter((p) => p.serviceId !== id) })
    else {
      const plan = plans[id]?.[0]
      // Having it today usually means you want to keep it: mark it as wished.
      set({
        paysFor: [...a.paysFor, { serviceId: id, productId: plan?.id ?? null, monthly: plan?.price ?? null, via: 'self' }],
        wants: a.wants.includes(id) ? a.wants : [...a.wants, id],
      })
    }
  }
  const updatePaid = (id: string, patch: Partial<PaidService>) =>
    set({ paysFor: a.paysFor.map((x) => (x.serviceId === id ? { ...x, ...patch } : x)) })
  const wishLevel = (id: string): 'no' | 'nice' | 'must' => ((a.mustHave ?? []).includes(id) ? 'must' : a.wants.includes(id) ? 'nice' : 'no')
  const setWish = (id: string, level: 'no' | 'nice' | 'must') =>
    set({
      wants: level === 'no' ? a.wants.filter((w) => w !== id) : a.wants.includes(id) ? a.wants : [...a.wants, id],
      mustHave: level === 'must' ? [...new Set([...(a.mustHave ?? []), id])] : (a.mustHave ?? []).filter((w) => w !== id),
    })

  const finish = () =>
    start(async () => {
      try {
        setError(null)
        await saveAnswers(memberId, name, a)
        router.push('/app')
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Noget gik galt')
      }
    })

  const paid = services.filter((s) => s.category !== 'free')
  const total = a.paysFor.reduce((s, p) => s + ((p.via ?? 'self') === 'self' ? p.monthly ?? 0 : 0), 0) + (a.mobile?.monthly ?? 0) + (a.broadband?.monthly ?? 0) + (a.tv?.monthly ?? 0)

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-8 flex items-center gap-2">
        {STEPS.map((s, i) => (
          <button
            key={s}
            onClick={() => setStep(i)}
            className={`h-1.5 flex-1 rounded-full transition ${i <= step ? 'bg-ink' : 'bg-line-2'}`}
            aria-label={`Trin ${i + 1}: ${s}`}
          />
        ))}
      </div>
      <div className="eyebrow">
        Trin {step + 1} af {STEPS.length}
        {forSomeoneElse && ` · udfylder for ${name}`}
      </div>

      {step === 0 && (
        <section>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Hvad har du i dag?</h1>
          <p className="mt-2 text-ink-2">
            Vælg de tjenester, du har adgang til nu, og fortæl hvordan. Fx er HBO Max tit med i et mobilabonnement, og Netflix kan
            være en del af en tv-pakke.
          </p>
          {forSomeoneElse && (
            <label className="mt-6 block max-w-xs">
              <span className="label">Navn</span>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
            </label>
          )}
          <div className="mt-6 grid min-w-0 gap-2">
            {grouped(paid).map((g) => [
              <div key={`h-${g.category}`} className="eyebrow mt-3 first:mt-0">{g.label}</div>,
              ...g.items.map((s) => {
              const p = pays(s.id)
              return (
                <div key={s.id} className={`min-w-0 rounded-2xl border bg-card transition ${p ? 'border-ink' : 'border-line hover:border-ink-3'}`}>
                  <button type="button" onClick={() => togglePays(s.id)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left">
                    <BrandMark id={s.id} name={s.name} color={s.color} />
                    <span className="flex-1 font-medium">{s.name}</span>
                    <span className={`grid size-6 place-items-center rounded-full border text-sm ${p ? 'border-ink bg-ink text-paper' : 'border-line-2 text-transparent'}`}>✓</span>
                  </button>
                  {p && (
                    <div className="grid min-w-0 gap-3 border-t border-line px-3 py-3 sm:grid-cols-[1fr_auto]">
                      <div>
                        <span className="label">Hvordan har du det?</span>
                        <Segmented<PaidVia>
                          value={p.via ?? 'self'}
                          onChange={(via) => updatePaid(s.id, { via })}
                          options={[
                            ['self', 'Eget abonnement'],
                            ['mobile', 'Med mobilen'],
                            ['broadband', 'Med internet'],
                            ['tv', 'Med TV-pakken'],
                            ['other', 'En anden betaler'],
                          ]}
                        />
                      </div>
                      {(p.via ?? 'self') === 'self' && (
                        <div className="flex min-w-0 flex-wrap gap-2">
                          <label className="block">
                            <span className="label">Abonnement</span>
                            <select
                              className="input h-10 w-auto max-w-full min-w-0 sm:min-w-40"
                              value={p.productId ?? ''}
                              onChange={(e) => {
                                const plan = plans[s.id]?.find((x) => x.id === e.target.value)
                                updatePaid(s.id, { productId: plan?.id ?? null, monthly: plan?.price ?? p.monthly })
                              }}
                            >
                              {(plans[s.id] ?? []).map((pl) => (
                                <option key={pl.id} value={pl.id}>{pl.name} · {pl.price} kr.</option>
                              ))}
                              <option value="">Ved ikke</option>
                            </select>
                          </label>
                          <label className="block">
                            <span className="label">Pris</span>
                            <input
                              type="number"
                              min={0}
                              inputMode="numeric"
                              value={p.monthly ?? ''}
                              placeholder="kr."
                              onChange={(e) => updatePaid(s.id, { monthly: e.target.value === '' ? null : Number(e.target.value) })}
                              className="input num h-10 w-24"
                            />
                          </label>
                        </div>
                      )}
                      {p.via && p.via !== 'self' && (
                        <p className="self-end text-sm text-ink-3 sm:col-span-2">
                          {p.via === 'other'
                            ? 'Fx en forælder eller ven uden for familien. Vi regner det som gratis for jer.'
                            : 'Prisen er med i den regning, du fortæller om i trin 3.'}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )
            }),
            ])}
          </div>
        </section>
      )}

      {step === 1 && (
        <section>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Hvad vil du gerne have?</h1>
          <p className="mt-2 text-ink-2">
            Det er ønsker, ikke køb. Bagefter viser vi, hvor mange af familiens ønsker I kan få for jeres budget.
            <b className="font-medium text-ink"> Skal have</b> bliver aldrig valgt fra; <b className="font-medium text-ink">Gerne</b> kommer med, hvis
            der er råd.
          </p>
          {grouped(services).map((g) => (
          <div key={g.category} className="mt-6">
          <div className="eyebrow mb-2">{g.label}</div>
          <ul className="divide-y divide-line rounded-2xl border border-line bg-card">
            {g.items.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                <BrandMark id={s.id} name={s.name} color={s.color} />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{s.name}</span>
                  {s.category === 'free' && <span className="block text-xs text-ink-3">Gratis</span>}
                  {pays(s.id) && <span className="block text-xs text-ink-3">Har du i dag</span>}
                </span>
                <Segmented
                  value={wishLevel(s.id)}
                  onChange={(v) => setWish(s.id, v)}
                  options={[
                    ['no', 'Nej'],
                    ['nice', 'Gerne'],
                    ['must', 'Skal have'],
                  ]}
                />
              </li>
            ))}
          </ul>
          </div>
          ))}
        </section>
      )}

      {step === 2 && (
        <section className="space-y-6">
          <div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Mobil, internet og TV</h1>
            <p className="mt-2 text-ink-2">
              Udfyld det, du selv betaler for. Kender du ikke prisen, så lad feltet stå tomt, så bruger vi en typisk pris.
            </p>
          </div>
          <BillField
            title="Mobilabonnement"
            value={a.mobile}
            onChange={(mobile) => set({ mobile })}
            telcos={telcos.filter((t) => t.offers.includes('mobile'))}
          >
            <div className="mt-4">
              <span className="label">Hvor meget data bruger du?</span>
              <Segmented
                value={a.dataNeed}
                onChange={(dataNeed) => set({ dataNeed })}
                options={[
                  ['low', 'Lidt', 'Under 10 GB'],
                  ['mid', 'Normalt', '10–50 GB'],
                  ['high', 'Meget', '50 GB+'],
                ]}
              />
            </div>
          </BillField>
          <BillField
            title="Internet derhjemme"
            hint="Kun hvis du står for regningen"
            value={a.broadband}
            onChange={(broadband) => set({ broadband })}
            telcos={telcos.filter((t) => t.offers.includes('broadband'))}
            binding
          />
          <BillField
            title="TV-pakke"
            hint="Fx YouSee, Norlys eller Waoo"
            value={a.tv}
            onChange={(tv) => set({ tv })}
            telcos={telcos.filter((t) => t.offers.includes('tv'))}
            binding
          />
        </section>
      )}

      {step === 3 && (
        <section className="space-y-6">
          <div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Er du klar til at skifte?</h1>
            <p className="mt-2 text-ink-2">Gælder både streaming, mobil og internet.</p>
          </div>
          <div className="space-y-2">
            {(
              [
                ['yes', 'Ja, gerne', 'Find det billigste, så skifter jeg.'],
                ['if-worth-it', 'Hvis det kan betale sig', 'Kun hvis jeg sparer mindst 30–40 kr. om måneden.'],
                ['no', 'Nej, jeg beholder det jeg har', 'Vi regner med dine nuværende abonnementer.'],
              ] as const
            ).map(([v, t, b]) => (
              <label
                key={v}
                className={`flex cursor-pointer items-start gap-3 rounded-2xl border bg-card px-4 py-3.5 transition ${a.willingToSwitch === v ? 'border-ink' : 'border-line hover:border-ink-3'}`}
              >
                <input type="radio" checked={a.willingToSwitch === v} onChange={() => set({ willingToSwitch: v })} className="mt-1 accent-[var(--color-ink)]" />
                <span>
                  <span className="block font-medium">{t}</span>
                  <span className="block text-sm text-ink-2">{b}</span>
                </span>
              </label>
            ))}
          </div>
          <div className="card divide-y divide-line">
            <Check label="Jeg er studerende" sub="Giver adgang til studierabatter." checked={a.student} onChange={(student) => set({ student })} />
          </div>
          <div className="rounded-2xl bg-sunk px-5 py-4 text-[15px]">
            {forSomeoneElse ? `${name} betaler` : 'Du betaler'} i alt cirka <b className="num">{total.toLocaleString('da-DK')} kr.</b> om måneden i dag.
          </div>
          {error && <p className="text-sm text-risk">{error}</p>}
        </section>
      )}

      <div className="mt-10 flex items-center justify-between">
        <button type="button" className="btn-quiet" onClick={() => setStep((s) => s - 1)} disabled={step === 0}>
          Tilbage
        </button>
        {step < STEPS.length - 1 ? (
          <button type="button" className="btn-primary" onClick={() => setStep((s) => s + 1)}>
            Næste
          </button>
        ) : (
          <button type="button" className="btn-brand" onClick={finish} disabled={pending}>
            {pending ? 'Gemmer…' : 'Gem og se resultatet'}
          </button>
        )}
      </div>
    </div>
  )
}

function BillField({
  title,
  hint,
  value,
  onChange,
  telcos,
  binding,
  children,
}: {
  title: string
  hint?: string
  value: CurrentBill | null
  onChange: (v: CurrentBill | null) => void
  telcos: { id: string; name: string }[]
  binding?: boolean
  children?: React.ReactNode
}) {
  const on = value !== null
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="font-semibold">{title}</div>
          {hint && <div className="text-sm text-ink-3">{hint}</div>}
        </div>
        <Segmented
          value={on ? 'yes' : 'no'}
          onChange={(v) => onChange(v === 'yes' ? { providerId: telcos[0]?.id ?? null, monthly: null, bindingLeft: 0 } : null)}
          options={[
            ['no', 'Nej'],
            ['yes', 'Ja'],
          ]}
        />
      </div>
      {on && (
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <label className="block sm:col-span-1">
            <span className="label">Selskab</span>
            <select
              className="input"
              value={value.providerId ?? 'other'}
              onChange={(e) => onChange({ ...value, providerId: e.target.value === 'other' ? null : e.target.value })}
            >
              {telcos.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
              <option value="other">Andet</option>
            </select>
          </label>
          {value.providerId === null && (
            <label className="block">
              <span className="label">Hvilket?</span>
              <input className="input" value={value.other ?? ''} onChange={(e) => onChange({ ...value, other: e.target.value })} />
            </label>
          )}
          <label className="block">
            <span className="label">Pris pr. måned</span>
            <input
              className="input num"
              type="number"
              min={0}
              inputMode="numeric"
              placeholder="kr."
              value={value.monthly ?? ''}
              onChange={(e) => onChange({ ...value, monthly: e.target.value === '' ? null : Number(e.target.value) })}
            />
          </label>
          {binding && (
            <label className="block">
              <span className="label">Binding tilbage</span>
              <select
                className="input"
                value={value.bindingLeft ?? 0}
                onChange={(e) => onChange({ ...value, bindingLeft: Number(e.target.value) })}
              >
                <option value={0}>Ingen / ved ikke</option>
                {[1, 3, 6, 12, 24].map((m) => (
                  <option key={m} value={m}>{m} mdr.</option>
                ))}
              </select>
            </label>
          )}
        </div>
      )}
      {on && children}
    </div>
  )
}

function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: (readonly [T, string, string?])[] }) {
  return (
    <div className="inline-flex flex-wrap rounded-[18px] border border-line-2 bg-sunk p-0.5">
      {options.map(([v, l, sub]) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={`rounded-full px-3.5 py-1.5 text-sm transition ${value === v ? 'bg-card font-medium text-ink shadow-sm' : 'text-ink-2 hover:text-ink'}`}
          title={sub}
        >
          {l}
          {sub && <span className="ml-1 hidden text-xs text-ink-3 sm:inline">{sub}</span>}
        </button>
      ))}
    </div>
  )
}

function Check({ label, sub, checked, onChange }: { label: string; sub: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 px-5 py-4">
      <span>
        <span className="block font-medium">{label}</span>
        <span className="block text-sm text-ink-2">{sub}</span>
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
