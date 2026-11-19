import { redirect } from 'next/navigation'
import { requireFamily } from '@/lib/data'
import { answersOf } from '@/lib/engine'
import { Onboarding } from './Onboarding'

export default async function Page({ searchParams }: { searchParams: Promise<{ for?: string }> }) {
  const { for: forId } = await searchParams
  const { me, members, ctx } = await requireFamily()
  const target = forId ? members.find((m) => m.id === forId) : me
  if (!target) redirect('/app/family')
  if (target.userId && target.userId !== me.userId) redirect('/app/family')

  // The plans you can have for each service (incl. bundles that contain it, like Apple One).
  const plans = Object.fromEntries(
    ctx.services.map((s) => [
      s.id,
      ctx.products
        .filter((p) => p.active && (p.category === 'streaming' || p.category === 'bundle') && p.includes.some((i) => i.serviceId === s.id))
        .sort((a, b) => a.price - b.price)
        .map((p) => ({ id: p.id, name: p.category === 'bundle' ? p.name : p.name, price: p.price })),
    ]),
  )
  return (
    <Onboarding
      memberId={target.id === me.id ? null : target.id}
      initialName={target.name}
      forSomeoneElse={target.id !== me.id}
      initial={target.answers ? answersOf(target) : null}
      services={ctx.services.map((s) => ({ id: s.id, name: s.name, color: s.color, category: s.category }))}
      telcos={ctx.providers.filter((p) => p.kind === 'telco').map((p) => ({ id: p.id, name: p.name, offers: p.offers }))}
      telcoPlans={ctx.products
        .filter((p) => p.active && ['mobile', 'broadband', 'tv'].includes(p.category))
        .sort((a, b) => a.price - b.price)
        .map((p) => ({
          id: p.id,
          providerId: p.providerId,
          category: p.category as 'mobile' | 'broadband' | 'tv',
          name: p.name,
          price: p.price,
          introPrice: p.introPrice,
          introMonths: p.introMonths,
          bindingMonths: p.bindingMonths,
          dataGb: p.attributes.dataGb ?? null,
          speedMbit: p.attributes.speedMbit ?? null,
          includes: p.includes.map((i) => i.serviceId),
          choose: p.attributes.choose ?? null,
        }))}
      plans={plans}
    />
  )
}
