import { currentUser } from '@clerk/nextjs/server'
import { asc, eq } from 'drizzle-orm'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { joinFamily } from '@/app/app/actions'
import { Logo } from '@/components/ui'
import { db, families, households, members } from '@/db'
import { myMembership } from '@/lib/data'
import { HouseholdPicker } from './HouseholdPicker'

export default async function Join({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  if (await myMembership()) redirect('/app')
  const [family] = await db.select().from(families).where(eq(families.inviteCode, code))
  if (!family) {
    return (
      <main className="mx-auto max-w-md flex-1 px-5 py-20 text-center">
        <Logo />
        <h1 className="mt-10 text-2xl font-semibold">Linket virker ikke</h1>
        <p className="mt-2 text-ink-2">Bed om et nyt link, eller <Link className="underline" href="/app/start">opret din egen familie</Link>.</p>
      </main>
    )
  }
  const [hs, ms, user] = await Promise.all([
    db.select().from(households).where(eq(households.familyId, family.id)).orderBy(asc(households.name)),
    db.select().from(members).where(eq(members.familyId, family.id)),
    currentUser(),
  ])
  const join = joinFamily.bind(null, code)
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-5 py-12">
      <Logo />
      <h1 className="mt-10 text-3xl font-semibold tracking-tight">Du er inviteret til {family.name}</h1>
      <p className="mt-2 text-ink-2">
        {ms.length} {ms.length === 1 ? 'person er' : 'personer er'} allerede med. Fortæl hvem du er og hvor du bor, så kan
        vi finde den bedste løsning for jer alle.
      </p>
      <form action={join} className="card mt-8 space-y-5 p-6">
        <label className="block">
          <span className="label">Dit navn</span>
          <input name="myName" className="input" defaultValue={user?.firstName ?? ''} required />
        </label>
        <HouseholdPicker households={hs.map((h) => ({ id: h.id, name: h.name, people: ms.filter((m) => m.householdId === h.id).map((m) => m.name) }))} />
        <button className="btn-primary w-full">Fortsæt</button>
      </form>
    </main>
  )
}
