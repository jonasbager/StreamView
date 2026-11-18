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

  const cheapest = Object.fromEntries(
    ctx.services.map((s) => {
      const prices = ctx.products.filter((p) => p.category === 'streaming' && p.includes.some((i) => i.serviceId === s.id) && !p.attributes.requires).map((p) => p.price)
      return [s.id, prices.length ? Math.min(...prices) : 0]
    }),
  )
  return (
    <Onboarding
      memberId={target.id === me.id ? null : target.id}
      initialName={target.name}
      forSomeoneElse={target.id !== me.id}
      initial={target.answers ? answersOf(target) : null}
      services={ctx.services.map((s) => ({ id: s.id, name: s.name, color: s.color, category: s.category }))}
      telcos={ctx.providers.filter((p) => p.kind === 'telco').map((p) => ({ id: p.id, name: p.name, offers: p.offers }))}
      cheapest={cheapest}
    />
  )
}
