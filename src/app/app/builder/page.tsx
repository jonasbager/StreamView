import { requireFamily } from '@/lib/data'
import { Catalog, optimise } from '@/lib/engine'
import { Builder } from './Builder'

export default async function BuilderPage() {
  const { family, ctx } = await requireFamily()
  const initial = family.board?.packages ?? optimise(new Catalog(ctx), 'legal')
  return <Builder ctx={ctx} initial={initial} savedAt={family.board?.updatedAt ?? null} />
}
