'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Mark } from '@/components/ui'
import type { Answers, CurrentBill } from '@/db/schema'
import { saveAnswers } from '../actions'

interface Props {
  memberId: string | null
  initialName: string
  forSomeoneElse: boolean
  initial: Answers | null
  services: { id: string; name: string; color: string; category: string }[]
  telcos: { id: string; name: string; offers: ('mobile' | 'broadband' | 'tv')[] }[]
  cheapest: Record<string, number>
}

const STEPS = ['Betaler for', 'Vil gerne have', 'Mobil & internet', 'Skifte?']

const empty: Answers = {
  paysFor: [],
  wants: ['drtv'],
  mobile: null,
  broadband: null,
  tv: null,
  willingToSwitch: 'if-worth-it',
  dataNeed: 'mid',
  adsOk: true,
  student: false,
}

export function Onboarding({ memberId, initialName, forSomeoneElse, initial, services, telcos, cheapest }: Props) {
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
    else set({ paysFor: [...a.paysFor, { serviceId: id, monthly: cheapest[id] ?? null }], wants: a.wants.includes(id) ? a.wants : [...a.wants, id] })
  }
  const toggleWant = (id: string) => set({ wants: a.wants.includes(id) ? a.wants.filter((w) => w !== id) : [...a.wants, id] })

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
  const total = a.paysFor.reduce((s, p) => s + (p.monthly ?? 0), 0) + (a.mobile?.monthly ?? 0) + (a.broadband?.monthly ?? 0) + (a.tv?.monthly ?? 0)

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
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Hvad betaler du for i dag?</h1>
          <p className="mt-2 text-ink-2">Kun det du selv betaler. Juster prisen, hvis du kender den.</p>
          {forSomeoneElse && (
            <label className="mt-6 block max-w-xs">
              <span className="label">Navn</span>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
            </label>
          )}
          <div className="mt-6 grid gap-2 sm:grid-cols-2">
            {paid.map((s) => {
              const p = pays(s.id)
              return (
                <div
                  key={s.id}
                  className={`flex items-center gap-3 rounded-2xl border px-3 py-2.5 transition ${p ? 'border-ink bg-card' : 'border-line bg-card/60 hover:border-ink-3'}`}
                >
                  <button type="button" onClick={() => togglePays(s.id)} className="flex flex-1 items-center gap-3 text-left">
                    <Mark name={s.name} color={s.color} />
                    <span className="font-medium">{s.name}</span>
                  </button>
                  {p ? (
                    <label className="flex items-center gap-1 text-sm text-ink-2">
                      <input
                        type="number"
                        min={0}
                        inputMode="numeric"
                        value={p.monthly ?? ''}
                        onChange={(e) =>
                          set({ paysFor: a.paysFor.map((x) => (x.serviceId === s.id ? { ...x, monthly: e.target.value === '' ? null : Number(e.target.value) } : x)) })
                        }
                        className="num h-9 w-20 rounded-lg border border-line-2 px-2 text-right text-ink outline-none focus:border-ink"
                        aria-label={`Pris for ${s.name}`}
                      />
                      kr.
                    </label>
                  ) : (
                    <span className="text-sm text-ink-3">Nej</span>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}

      {step === 1 && (
        <section>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Hvad vil du gerne kunne se og høre?</h1>
          <p className="mt-2 text-ink-2">Også det du ikke betaler for i dag. Vi finder den billigste måde at få det på.</p>
          <div className="mt-6 flex flex-wrap gap-2">
            {services.map((s) => (
              <button key={s.id} type="button" className="chip" data-on={a.wants.includes(s.id)} onClick={() => toggleWant(s.id)}>
                <span className="size-2.5 rounded-full" style={{ background: s.color }} />
                {s.name}
                {s.category === 'free' && <span className="text-xs opacity-60">gratis</span>}
              </button>
            ))}
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="space-y-6">
          <div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Mobil, internet og TV</h1>
            <p className="mt-2 text-ink-2">Udfyld det, du selv betaler for. Spring resten over.</p>
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
            <Check label="Reklamer er okay" sub="Reklameplaner er ofte 30–60 kr. billigere." checked={a.adsOk} onChange={(adsOk) => set({ adsOk })} />
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
    <div className="inline-flex rounded-full border border-line-2 bg-sunk p-0.5">
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
