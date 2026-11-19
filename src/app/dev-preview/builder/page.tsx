import { Builder } from '@/app/app/builder/Builder'
import { DEFAULT_SETTINGS } from '@/db/schema'
import { Catalog, todayBoard } from '@/lib/engine'
import { fixtureCtx } from '../fixture'

export default async function Page() {
  const ctx = await fixtureCtx()
  const today = todayBoard(new Catalog(ctx))
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8">
      <Builder ctx={ctx} initial={today} today={today} settings={DEFAULT_SETTINGS} savedAt="x" />
    </main>
  )
}
