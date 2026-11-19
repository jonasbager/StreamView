import Link from 'next/link'
import { BrandMark } from '@/components/BrandMark'
import { InviteLink } from '@/components/InviteLink'
import { Person, personColor } from '@/components/ui'
import { DEFAULT_SETTINGS } from '@/db/schema'
import { requireFamily } from '@/lib/data'
import { answersOf, Catalog } from '@/lib/engine'
import { BudgetExplorer } from '../BudgetExplorer'

const VIA_DA = { self: '', mobile: 'via mobil', broadband: 'via internet', tv: 'via TV', other: 'betales af en anden' } as const

export default async function Explore() {
  const { me, family, members, households, ctx } = await requireFamily()
  if (!me.answers) {
    return (
      <div className="mx-auto max-w-lg py-10 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Velkommen, {me.name}</h1>
        <p className="mt-3 text-ink-2">
          Fire korte spørgsmål: hvad du har i dag, hvad du gerne vil have, dine mobil- og internetregninger, og om du vil skifte.
        </p>
        <Link href="/app/onboarding" className="btn-brand mt-8">Kom i gang</Link>
      </div>
    )
  }

  const cat = new Catalog(ctx)
  const waiting = members.filter((m) => !m.answers)
  const idx = new Map(members.map((m, i) => [m.id, i]))

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="eyebrow">{family.name}</div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Hvad kan I få for pengene?</h1>
          <p className="mt-1 max-w-2xl text-ink-2">
            Leg med et beløb og se, hvor mange af jeres ønsker der er plads til, og hvad det betyder at være lidt mere fleksible.
          </p>
        </div>
        <Link href="/app" className="btn-quiet btn-sm">Til jeres opsætning</Link>
      </div>

      {waiting.length > 0 && (
        <section className="card flex flex-col gap-4 p-5 md:flex-row md:items-center">
          <div className="flex-1">
            <div className="font-semibold">Mangler svar fra {waiting.map((m) => m.name).join(', ')}</div>
            <div className="text-sm text-ink-2">Beregningen bliver mere præcis, når alle har svaret.</div>
          </div>
          <div className="md:w-96">
            <InviteLink code={family.inviteCode} />
          </div>
        </section>
      )}

      <BudgetExplorer ctx={ctx} initial={{ ...DEFAULT_SETTINGS, ...(family.settings ?? {}) }} />

      <section>
        <h2 className="mb-3 text-xl font-semibold tracking-tight">Hvad I har i dag</h2>
        <div className="card divide-y divide-line">
          {households.map((h) => (
            <div key={h.id} className="p-5">
              <div className="mb-3 font-medium">{h.name}</div>
              <div className="space-y-3">
                {members.filter((m) => m.householdId === h.id).map((m) => {
                  const a = m.answers ? answersOf(m) : null
                  return (
                    <div key={m.id} className="flex flex-wrap items-center gap-3">
                      <Person name={m.name} color={personColor(idx.get(m.id) ?? 0)} />
                      <span className="w-24 text-[15px]">{m.name}</span>
                      {!a ? (
                        <span className="text-sm text-ink-3">Har ikke svaret endnu</span>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {a.paysFor.length === 0 && !a.mobile && !a.broadband && !a.tv && <span className="text-sm text-ink-3">Betaler ikke for noget</span>}
                          {a.paysFor.map((p) => {
                            const s = cat.service.get(p.serviceId)
                            const plan = p.productId ? cat.product.get(p.productId)?.name : null
                            return s ? (
                              <span key={p.serviceId} className="inline-flex items-center gap-1.5 rounded-full bg-sunk py-1 pr-2.5 pl-1 text-xs">
                                <BrandMark id={s.id} name={s.name} color={s.color} size={18} />
                                {s.name}
                                {plan && <span className="text-ink-3">{plan}</span>}
                                {p.via && p.via !== 'self' && <span className="text-ink-3">{VIA_DA[p.via]}</span>}
                              </span>
                            ) : null
                          })}
                          {(['mobile', 'broadband', 'tv'] as const).map((k) =>
                            a[k] ? (
                              <span key={k} className="rounded-full bg-sunk px-2.5 py-1 text-xs">
                                {{ mobile: 'Mobil', broadband: 'Internet', tv: 'TV' }[k]}
                                {a[k]!.providerId ? ` · ${cat.provider.get(a[k]!.providerId!)?.name}` : a[k]!.other ? ` · ${a[k]!.other}` : ''}
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
          ))}
        </div>
      </section>
    </div>
  )
}
