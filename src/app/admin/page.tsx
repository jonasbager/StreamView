import { desc, eq } from 'drizzle-orm'
import { SubmitButton } from '@/components/SubmitButton'
import { BrandMark } from '@/components/BrandMark'
import { db, priceChanges, priceRuns, products, providers } from '@/db'
import { kr } from '@/lib/format'
import { approveAll, decide, runNow, setPriceUrls } from './actions'

export default async function Admin() {
  const [pending, runs, provs, prods] = await Promise.all([
    db.select().from(priceChanges).where(eq(priceChanges.status, 'pending')).orderBy(priceChanges.providerId),
    db.select().from(priceRuns).orderBy(desc(priceRuns.startedAt)).limit(5),
    db.select().from(providers).orderBy(providers.name),
    db.select().from(products),
  ])
  const byProvider = provs
    .map((p) => ({ p, changes: pending.filter((c) => c.providerId === p.id) }))
    .filter((g) => g.changes.length)
  const lastRun = runs[0]
  const verified = prods.filter((p) => p.verifiedAt).length

  return (
    <div className="space-y-10">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Priser</h1>
          <p className="mt-1 text-ink-2">
            Hver mandag læser vi udbydernes sider. Uændrede priser bekræftes automatisk; resten venter her.{' '}
            {verified} af {prods.length} produkter er bekræftet.
          </p>
        </div>
        <form action={runNow.bind(null, undefined)}>
          <SubmitButton pendingText="Henter priser… (op til 5 min.)" className="btn-primary btn-sm">Hent alle priser nu</SubmitButton>
        </form>
      </section>

      <section>
        <h2 className="mb-3 text-xl font-semibold tracking-tight">Til godkendelse ({pending.length})</h2>
        {byProvider.length === 0 ? (
          <div className="card p-8 text-center text-ink-2">Intet at godkende.</div>
        ) : (
          <div className="space-y-4">
            {byProvider.map(({ p, changes }) => (
              <div key={p.id} className="card">
                <div className="flex items-center gap-3 border-b border-line px-5 py-4">
                  <BrandMark id={p.id} name={p.name} color={p.color} />
                  <div className="flex-1 font-semibold">{p.name}</div>
                  <form action={approveAll.bind(null, p.id)}>
                    <SubmitButton pendingText="Godkender…" className="btn-quiet btn-sm">Godkend alle</SubmitButton>
                  </form>
                </div>
                <ul className="divide-y divide-line">
                  {changes.map((c) => {
                    const cur = prods.find((x) => x.id === c.productId)
                    return (
                      <li key={c.id} className="flex flex-wrap items-start gap-4 px-5 py-4">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${c.kind === 'new' ? 'bg-brand-soft text-brand' : c.kind === 'gone' ? 'bg-risk-soft text-risk' : 'bg-warn-soft text-warn'}`}
                        >
                          {{ new: 'Ny', update: 'Ændret', gone: 'Væk' }[c.kind]}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="font-medium">
                            {c.proposed?.name ?? cur?.name}
                            {c.proposed && <span className="num ml-2 text-ink-2">{kr(c.proposed.price)}</span>}
                          </div>
                          <ul className="mt-1 space-y-0.5 text-sm text-ink-2">
                            {c.diff.map((d) => <li key={d}>{d}</li>)}
                          </ul>
                          {c.sourceUrl && (
                            <a href={c.sourceUrl} target="_blank" rel="noreferrer" className="mt-1 block truncate text-xs text-ink-3 underline">
                              {c.sourceUrl}
                            </a>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <form action={decide.bind(null, c.id, false)}>
                            <button className="btn-quiet btn-sm">Afvis</button>
                          </form>
                          <form action={decide.bind(null, c.id, true)}>
                            <button className="btn-brand btn-sm">Godkend</button>
                          </form>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-xl font-semibold tracking-tight">Seneste kørsel</h2>
        {!lastRun ? (
          <div className="card p-6 text-ink-2">Ingen kørsler endnu.</div>
        ) : (
          <div className="card">
            <div className="border-b border-line px-5 py-3 text-sm text-ink-2">
              {new Date(lastRun.startedAt).toLocaleString('da-DK')} · {lastRun.trigger === 'cron' ? 'automatisk' : 'manuelt'}
              {!lastRun.finishedAt && ' · kører stadig'}
            </div>
            <ul className="divide-y divide-line text-sm">
              {lastRun.log.map((l) => (
                <li key={l.providerId} className="flex gap-3 px-5 py-2.5">
                  <span className={`w-20 shrink-0 font-medium ${l.ok ? '' : 'text-risk'}`}>{provs.find((p) => p.id === l.providerId)?.name}</span>
                  <span className="text-ink-2">{l.message}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-1 text-xl font-semibold tracking-tight">Kilder</h2>
        <p className="mb-3 text-sm text-ink-2">Første adresse er forsiden. Resten er prissider; tomme findes automatisk.</p>
        <div className="card divide-y divide-line">
          {provs.map((p) => (
            <form key={p.id} action={setPriceUrls.bind(null, p.id)} className="flex flex-wrap items-center gap-3 px-5 py-3">
              <span className="w-32 shrink-0 font-medium">{p.name}</span>
              <input name="urls" defaultValue={p.priceUrls.join(' ')} className="input h-9 min-w-0 flex-1 text-sm" />
              <button className="btn-quiet btn-sm">Gem</button>
              <button formAction={runNow.bind(null, p.id)} className="btn-quiet btn-sm">Hent nu</button>
            </form>
          ))}
        </div>
      </section>
    </div>
  )
}
