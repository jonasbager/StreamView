import { currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { myMembership } from '@/lib/data'
import { createFamily } from '../actions'

export default async function Start() {
  if (await myMembership()) redirect('/app')
  const user = await currentUser()
  return (
    <div className="mx-auto max-w-md py-6">
      <h1 className="text-3xl font-semibold tracking-tight">Opret jeres familie</h1>
      <p className="mt-2 text-ink-2">
        Bagefter får du et link, du kan sende til resten af familien. Har du fået et link? Så åbn det i stedet.
      </p>
      <form action={createFamily} className="card mt-8 space-y-5 p-6">
        <label className="block">
          <span className="label">Dit navn</span>
          <input name="myName" className="input" defaultValue={user?.firstName ?? ''} required />
        </label>
        <label className="block">
          <span className="label">Familiens navn</span>
          <input name="familyName" className="input" placeholder="Fx Familien Jensen" required />
        </label>
        <label className="block">
          <span className="label">Hvad kalder I jeres hjem?</span>
          <input name="homeName" className="input" placeholder="Fx Hjemme på Østerbro" />
          <span className="mt-1.5 block text-sm text-ink-3">Et hjem er én adresse. De fleste tjenester må kun deles inden for ét hjem.</span>
        </label>
        <button className="btn-primary w-full">Fortsæt</button>
      </form>
    </div>
  )
}
