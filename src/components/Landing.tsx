import Link from 'next/link'
import { Logo, RiskPill } from '@/components/ui'

export function Landing({ userId }: { userId: string | null }) {
  const cta = userId ? '/app' : '/sign-up'

  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5">
        <Logo />
        <nav className="flex items-center gap-2">
          {userId ? (
            <Link href="/app" className="btn-primary btn-sm">Gå til overblik</Link>
          ) : (
            <>
              <Link href="/sign-in" className="btn btn-sm text-ink-2 hover:text-ink">Log ind</Link>
              <Link href="/sign-up" className="btn-primary btn-sm">Kom i gang</Link>
            </>
          )}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-6xl px-5">
        <section className="grid items-center gap-12 py-14 md:grid-cols-[1.1fr_1fr] md:py-24">
          <div>
            <h1 className="text-[40px] leading-[1.05] font-semibold tracking-[-0.03em] text-balance md:text-[56px]">
              Flest mulige tjenester for familiens budget.
            </h1>
            <p className="mt-5 max-w-lg text-lg leading-relaxed text-ink-2">
              Fortæl hvad I har, og hvad I gerne vil have. Sæt et budget, og se hvor mange ønsker I kan få opfyldt, og hvor meget
              mere I får ved at være lidt fleksible: reklamer, binding, et nyt mobilselskab eller at dele med familien.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href={cta} className="btn-brand">Start gratis</Link>
              <span className="text-sm text-ink-3">Tager cirka 3 minutter pr. person</span>
            </div>
          </div>

          <div className="card p-6 shadow-[0_1px_0_rgba(0,0,0,0.02),0_12px_40px_-12px_rgba(31,77,58,0.18)]">
            <div className="eyebrow">Familien Jensen · 3 hjem, 6 personer</div>
            <div className="mt-5 grid grid-cols-2 gap-6">
              <div>
                <div className="text-sm text-ink-2">I dag</div>
                <div className="num mt-1 text-3xl font-semibold tracking-tight text-ink-3 line-through decoration-1">3.412 kr.</div>
              </div>
              <div>
                <div className="text-sm text-ink-2">Med StreamView</div>
                <div className="num mt-1 text-3xl font-semibold tracking-tight">2.186 kr.</div>
              </div>
            </div>
            <div className="mt-5 rounded-2xl bg-brand-soft px-4 py-3 text-[15px] text-brand">
              I sparer <b className="num">1.226 kr.</b> om måneden, eller <b className="num">14.712 kr.</b> om året.
            </div>
            <ul className="mt-5 divide-y divide-line text-[15px]">
              {[
                ['Spotify Family til hele huset', '189 kr.'],
                ['Netflix + ekstra medlem til mormor', '178 kr.'],
                ['Mobil: 4 abonnementer hos et billigere selskab', '436 kr.'],
                ['Fiber 1000 Mbit (uden binding)', '299 kr.'],
              ].map(([l, r]) => (
                <li key={l} className="flex justify-between gap-4 py-2.5">
                  <span className="text-ink-2">{l}</span>
                  <span className="num font-medium">{r}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="grid gap-4 border-t border-line py-16 md:grid-cols-3">
          {[
            ['1. Inviter familien', 'Del et link. Hver person svarer selv på, hvad de betaler for, hvad de ser, og hvilket mobil- og internetselskab de har.'],
            ['2. Få et forslag', 'Vi finder den billigste kombination af abonnementer, familieplaner og pakker. Priserne opdateres hver uge.'],
            ['3. Byg jeres pakker', 'Træk tjenester og personer rundt mellem pakkerne. Prisen og eventuelle advarsler opdateres med det samme.'],
          ].map(([t, b]) => (
            <div key={t}>
              <h3 className="text-[17px] font-semibold">{t}</h3>
              <p className="mt-2 leading-relaxed text-ink-2">{b}</p>
            </div>
          ))}
        </section>

        <section className="grid gap-10 border-t border-line py-16 md:grid-cols-2">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight">Den lovlige vej. Og den grå zone.</h2>
            <p className="mt-4 leading-relaxed text-ink-2">
              Mange deler et login med familien i et andet hjem. Det er ikke piratkopiering, men det er ofte imod tjenestens
              vilkår. Vi viser begge løsninger side om side og fortæller ærligt, hvor hårdt hver tjeneste slår ned på det.
            </p>
          </div>
          <ul className="card divide-y divide-line">
            {[
              ['Apple TV · Familiedeling', 'none'],
              ['TV 2 Play', 'low'],
              ['Spotify Family', 'medium'],
              ['YouTube Premium', 'high'],
              ['Netflix', 'strict'],
            ].map(([n, l]) => (
              <li key={n} className="flex items-center justify-between gap-4 px-5 py-3.5">
                <span className="font-medium">{n}</span>
                <RiskPill level={l as 'none'} />
              </li>
            ))}
          </ul>
        </section>
      </main>

      <footer className="mx-auto w-full max-w-6xl border-t border-line px-5 py-8 text-sm text-ink-3">
        StreamView er ikke tilknyttet nogen streamingtjeneste eller noget teleselskab. Priser hentes ugentligt og kan afvige.
      </footer>
    </div>
  )
}
