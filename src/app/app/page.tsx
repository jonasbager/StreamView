import Link from 'next/link'
import { InviteLink } from '@/components/InviteLink'
import { SubmitButton } from '@/components/SubmitButton'
import { Mark, Person, personColor, RiskPill } from '@/components/ui'
import type { BoardPackage } from '@/db/schema'
import { requireFamily } from '@/lib/data'
import { Catalog, evaluate, optimise } from '@/lib/engine'
import { kr } from '@/lib/format'
import { applySetup, generateRecommendation } from './actions'

export default async function Overview() {
  const { me, family, members, households, ctx } = await requireFamily()
  if (!me.answers) {
    return (
      <div className="mx-auto max-w-lg py-10 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Velkommen, {me.name}</h1>
        <p className="mt-3 text-ink-2">Start med fire korte spørgsmål om, hvad du betaler for og hvad du gerne vil have.</p>
        <Link href="/app/onboarding" className="btn-brand mt-8">Svar på spørgsmålene</Link>
      </div>
    )
  }

  const cat = new Catalog(ctx)
  const answered = members.filter((m) => m.answers)
  const waiting = members.filter((m) => !m.answers)
  const idx = new Map(members.map((m, i) => [m.id, i]))
  const legal = evaluate(cat, optimise(cat, 'legal'))
  const bend = evaluate(cat, optimise(cat, 'bend', 'high'))
  const rec = family.recommendation
  const recEval = rec?.setups.map((s) => evaluate(cat, s.packages.map((p, i) => ({ ...p, id: String(i) }) as BoardPackage))) ?? []

  return (
    <div className="space-y-10">
      <section>
        <div className="eyebrow">{family.name}</div>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight md:text-4xl">
          {legal.saving > 0 ? (
            <>I kan spare <span className="num text-brand">{kr(legal.saving)}</span> om måneden, helt efter reglerne.</>
          ) : (
            <>I betaler allerede tæt på det billigste.</>
          )}
        </h1>
        <p className="mt-2 text-ink-2">
          Baseret på svar fra {answered.length} af {members.length} {members.length === 1 ? 'person' : 'personer'}.
          {waiting.length > 0 && ' Jo flere der svarer, jo bedre bliver forslaget.'}
        </p>
      </section>

      <section className="card grid gap-6 p-6 sm:grid-cols-3">
        <Totals label="I betaler i dag" value={legal.current} sub={`${kr(legal.current * 12)} om året`} tone="muted" />
        <Totals label="Billigst efter reglerne" value={legal.monthly} sub={legal.saving > 0 ? `Spar ${kr(legal.saving * 12)} om året` : 'Ingen besparelse'} tone="brand" />
        <Totals
          label="I den grå zone"
          value={bend.monthly}
          sub={legal.monthly - bend.monthly > 1 ? `Yderligere ${kr(legal.monthly - bend.monthly)} pr. md. ved at dele på tværs af hjem` : 'Ingen ekstra besparelse'}
        />
      </section>

      {waiting.length > 0 && (
        <section className="card flex flex-col gap-4 p-6 md:flex-row md:items-center">
          <div className="flex-1">
            <div className="font-semibold">Mangler svar fra {waiting.map((m) => m.name).join(', ')}</div>
            <div className="text-sm text-ink-2">Send linket, eller udfyld for dem under Familie.</div>
          </div>
          <div className="md:w-96">
            <InviteLink code={family.inviteCode} />
          </div>
        </section>
      )}

      <section>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Forslag til jer</h2>
            <p className="text-sm text-ink-2">
              {rec ? `Lavet ${new Date(rec.createdAt).toLocaleDateString('da-DK', { day: 'numeric', month: 'long' })}. ` : ''}
              AI sammensætter forslagene. Priserne regnes efter af os.
            </p>
          </div>
          <form action={generateRecommendation}>
            <SubmitButton pendingText="Tænker…" className="btn-quiet btn-sm">{rec ? 'Lav nye forslag' : 'Lav forslag'}</SubmitButton>
          </form>
        </div>

        {!rec ? (
          <div className="card p-8 text-center text-ink-2">
            Tryk på <b className="text-ink">Lav forslag</b>, så gennemgår vi jeres svar og alle tilbud og pakker.
          </div>
        ) : (
          <>
            <p className="mb-4 max-w-3xl text-[15px] leading-relaxed text-ink-2">{rec.intro}</p>
            <div className="grid gap-4 lg:grid-cols-2">
              {rec.setups.map((s, i) => {
                const r = recEval[i]
                return (
                  <article key={s.id} className="card flex flex-col p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-xs font-medium tracking-wide text-ink-3 uppercase">{s.kind === 'legal' ? 'Efter reglerne' : 'Grå zone'}</div>
                        <h3 className="mt-1 text-lg font-semibold">{s.title}</h3>
                      </div>
                      <div className="text-right">
                        <div className="num text-2xl font-semibold tracking-tight">{kr(r.monthly)}</div>
                        <div className="text-xs text-ink-3">pr. måned</div>
                      </div>
                    </div>
                    <p className="mt-2 text-[15px] text-ink-2">{s.summary}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {r.saving > 0 && <span className="rounded-full bg-brand-soft px-2.5 py-1 text-xs font-medium text-brand">Spar {kr(r.saving)} / md.</span>}
                      {r.maxRisk !== 'none' && <RiskPill level={r.maxRisk} />}
                      {r.missing.length > 0 && <span className="rounded-full bg-warn-soft px-2.5 py-1 text-xs font-medium text-warn">{r.missing.length} ønsker ikke dækket</span>}
                    </div>
                    <ul className="mt-4 space-y-1.5 text-[15px]">
                      {s.reasoning.map((t) => (
                        <li key={t} className="flex gap-2.5"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-ink-3" />{t}</li>
                      ))}
                    </ul>
                    <div className="mt-5 divide-y divide-line border-t border-line">
                      {s.packages.map((p, j) => (
                        <div key={j} className="flex items-center gap-3 py-2.5 text-sm">
                          <div className="flex -space-x-1.5">
                            {p.memberIds.slice(0, 4).map((mid) => {
                              const m = members.find((x) => x.id === mid)
                              return m ? <Person key={mid} name={m.name} color={personColor(idx.get(mid) ?? 0)} size={24} /> : null
                            })}
                          </div>
                          <span className="min-w-0 flex-1 truncate text-ink-2">
                            {p.productIds.map((id) => cat.priced(id)?.name).filter(Boolean).join(' · ')}
                          </span>
                          <span className="num font-medium">{kr(r.packages[j]?.monthly ?? 0)}</span>
                        </div>
                      ))}
                    </div>
                    <form action={applySetup.bind(null, s.id)} className="mt-auto pt-5">
                      <SubmitButton pendingText="Åbner…" className="btn-primary btn-sm">Åbn i pakkebyggeren</SubmitButton>
                    </form>
                  </article>
                )
              })}
            </div>
          </>
        )}
      </section>

      <section>
        <h2 className="mb-4 text-xl font-semibold tracking-tight">Hvad I betaler for i dag</h2>
        <div className="card divide-y divide-line">
          {households.map((h) => {
            const people = members.filter((m) => m.householdId === h.id)
            return (
              <div key={h.id} className="p-5">
                <div className="mb-3 font-medium">{h.name}</div>
                <div className="space-y-3">
                  {people.map((m) => {
                    const a = m.answers
                    return (
                      <div key={m.id} className="flex flex-wrap items-center gap-3">
                        <Person name={m.name} color={personColor(idx.get(m.id) ?? 0)} />
                        <span className="w-24 text-[15px]">{m.name}</span>
                        {!a ? (
                          <span className="text-sm text-ink-3">Har ikke svaret endnu</span>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {a.paysFor.map((p) => {
                              const s = cat.service.get(p.serviceId)
                              return s ? (
                                <span key={p.serviceId} className="inline-flex items-center gap-1.5 rounded-full bg-sunk py-1 pr-2.5 pl-1 text-xs">
                                  <Mark name={s.name} color={s.color} size={18} />
                                  {s.name}
                                </span>
                              ) : null
                            })}
                            {(['mobile', 'broadband', 'tv'] as const).map((k) =>
                              a[k] ? (
                                <span key={k} className="rounded-full bg-sunk px-2.5 py-1 text-xs">
                                  {{ mobile: 'Mobil', broadband: 'Internet', tv: 'TV' }[k]}
                                  {a[k]!.providerId ? ` · ${cat.provider.get(a[k]!.providerId!)?.name}` : ''}
                                </span>
                              ) : null,
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}

function Totals({ label, value, sub, tone }: { label: string; value: number; sub: string; tone?: 'brand' | 'muted' }) {
  return (
    <div>
      <div className="eyebrow">{label}</div>
      <div className={`num mt-1 text-3xl font-semibold tracking-tight ${tone === 'brand' ? 'text-brand' : tone === 'muted' ? 'text-ink-2' : ''}`}>{kr(value)}</div>
      <div className="mt-1 text-sm text-ink-3">{sub}</div>
    </div>
  )
}
