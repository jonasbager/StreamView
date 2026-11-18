import { Builder } from '@/app/app/builder/Builder'
import { Catalog, optimise } from '@/lib/engine'
import { fixtureCtx } from '../fixture'

export default async function Page() {
  const ctx = await fixtureCtx()
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8">
      <Builder ctx={ctx} initial={optimise(new Catalog(ctx), 'bend', 'high')} savedAt="x" />
    </main>
  )
}
