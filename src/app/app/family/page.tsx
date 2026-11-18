import Link from 'next/link'
import { InviteLink } from '@/components/InviteLink'
import { Person, personColor } from '@/components/ui'
import { requireFamily } from '@/lib/data'
import { addHousehold, addPlaceholderMember, removeMember } from '../actions'
import { MoveMember } from './MoveMember'

export default async function FamilyPage() {
  const { me, family, members, households } = await requireFamily()
  const owner = family.ownerUserId === me.userId
  const idx = new Map(members.map((m, i) => [m.id, i]))

  return (
    <div className="space-y-10">
      <section className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Familie</h1>
          <p className="mt-1 text-ink-2">Del linket, så kan alle svare selv. Eller udfyld for dem, der ikke vil oprette en konto.</p>
        </div>
        <div className="md:w-[26rem]">
          <InviteLink code={family.inviteCode} />
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {households.map((h) => {
          const people = members.filter((m) => m.householdId === h.id)
          return (
            <div key={h.id} className="card p-5">
              <div className="mb-1 font-semibold">{h.name}</div>
              <div className="mb-4 text-sm text-ink-3">{people.length} {people.length === 1 ? 'person' : 'personer'}</div>
              <ul className="divide-y divide-line">
                {people.map((m) => (
                  <li key={m.id} className="flex items-center gap-3 py-3">
                    <Person name={m.name} color={personColor(idx.get(m.id) ?? 0)} />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">
                        {m.name}
                        {m.id === me.id && <span className="ml-1.5 text-sm font-normal text-ink-3">(dig)</span>}
                      </div>
                      <div className="text-sm text-ink-3">
                        {m.answers ? 'Har svaret' : 'Mangler svar'}
                        {!m.userId && ' · uden konto'}
                      </div>
                    </div>
                    <MoveMember memberId={m.id} householdId={m.householdId} households={households.map((x) => ({ id: x.id, name: x.name }))} />
                    {(m.id === me.id || !m.userId) && (
                      <Link href={m.id === me.id ? '/app/onboarding' : `/app/onboarding?for=${m.id}`} className="btn-quiet btn-sm">
                        {m.answers ? 'Ret svar' : 'Udfyld'}
                      </Link>
                    )}
                    {owner && m.id !== me.id && (
                      <form action={removeMember.bind(null, m.id)}>
                        <button className="text-sm text-ink-3 hover:text-risk" aria-label={`Fjern ${m.name}`}>Fjern</button>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <form action={addPlaceholderMember} className="card space-y-4 p-5">
          <div>
            <div className="font-semibold">Udfyld for en anden</div>
            <div className="text-sm text-ink-2">Fx bedsteforældre eller børn uden egen konto. De kan stadig bruge linket senere.</div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <input name="name" className="input" placeholder="Navn" required />
            <select name="householdId" className="input">
              {households.map((h) => (
                <option key={h.id} value={h.id}>{h.name}</option>
              ))}
            </select>
          </div>
          <button className="btn-primary btn-sm">Fortsæt til spørgsmålene</button>
        </form>
        <form action={addHousehold} className="card space-y-4 p-5">
          <div>
            <div className="font-semibold">Tilføj et hjem</div>
            <div className="text-sm text-ink-2">Et hjem er én adresse. Bruges til at vurdere, hvad der må deles.</div>
          </div>
          <input name="name" className="input" placeholder="Fx Mormor og morfar" required />
          <button className="btn-quiet btn-sm">Tilføj hjem</button>
        </form>
      </section>
    </div>
  )
}
