import { BudgetExplorer } from '@/app/app/BudgetExplorer'
import { DEFAULT_SETTINGS } from '@/db/schema'
import { fixtureCtx } from '../fixture'

export default async function Page() {
  const ctx = await fixtureCtx()
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8">
      <BudgetExplorer ctx={ctx} initial={{ ...DEFAULT_SETTINGS, budget: 1500 }} />
    </main>
  )
}
