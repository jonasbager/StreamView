import { Onboarding } from '@/app/app/onboarding/Onboarding'
import { fixtureCtx } from '../fixture'

export default async function Page() {
  const ctx = await fixtureCtx()
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8">
      <Onboarding
        memberId={null}
        initialName="Anna"
        forSomeoneElse={false}
        initial={ctx.members[0].answers}
        services={ctx.services.map((s) => ({ id: s.id, name: s.name, color: s.color, category: s.category }))}
        telcos={ctx.providers.filter((p) => p.kind === 'telco').map((p) => ({ id: p.id, name: p.name, offers: p.offers }))}
        plans={Object.fromEntries(ctx.services.map((s) => [s.id, ctx.products.filter((p) => p.includes.some((i) => i.serviceId === s.id)).map((p) => ({ id: p.id, name: p.name, price: p.price }))]))}
      />
    </main>
  )
}
