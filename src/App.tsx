import { useMemo, useState } from 'react'
import { FamilyTab } from './components/FamilyTab'
import { PlanTab } from './components/PlanTab'
import { ServicesTab } from './components/ServicesTab'
import { PRESET_BUNDLES, SERVICES } from './data/catalog'
import { buildCatalog } from './lib/optimizer'
import { DEMO_STATE, EMPTY_STATE, shareUrl, usePersistentState } from './lib/store'

type Tab = 'plan' | 'family' | 'services'

const TABS: { id: Tab; label: string; long?: string }[] = [
  { id: 'plan', label: 'Best plan' },
  { id: 'family', label: 'Family' },
  { id: 'services', label: 'Services', long: 'Services & deals' },
]

export default function App() {
  const [state, setState] = usePersistentState()
  const [tab, setTab] = useState<Tab>('plan')
  const [copied, setCopied] = useState(false)

  const catalog = useMemo(
    () => buildCatalog(state, SERVICES, PRESET_BUNDLES),
    [state.priceOverrides, state.customDeals, state.hiddenBundles], // eslint-disable-line react-hooks/exhaustive-deps
  )

  const copyShare = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl(state))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      prompt('Copy this link', shareUrl(state))
    }
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-white/8 bg-[#0b0d12]/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <div className="flex items-center gap-2">
            <img src="/favicon.svg" alt="" className="size-7" />
            <span className="text-lg font-bold tracking-tight text-white">StreamView</span>
          </div>
          <nav className="order-3 flex w-full gap-1 sm:order-none sm:w-auto">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex-1 rounded-lg px-3 py-1.5 text-sm sm:flex-none ${
                  tab === t.id ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                <span className="sm:hidden">{t.label}</span>
                <span className="hidden sm:inline">{t.long ?? t.label}</span>
              </button>
            ))}
          </nav>
          <div className="ml-auto flex gap-2">
            <button className="btn-ghost text-sm" onClick={copyShare} title="Copy a link containing your family setup">
              {copied ? 'Link copied ✓' : 'Share'}
            </button>
            <details className="relative">
              <summary className="btn-ghost cursor-pointer list-none text-sm">Reset</summary>
              <div className="absolute right-0 mt-2 w-48 rounded-xl border border-white/10 bg-[#141722] p-1 text-sm shadow-xl">
                <button className="w-full rounded-lg px-3 py-2 text-left hover:bg-white/5" onClick={() => setState(() => DEMO_STATE)}>
                  Load example family
                </button>
                <button className="w-full rounded-lg px-3 py-2 text-left hover:bg-white/5" onClick={() => setState(() => EMPTY_STATE)}>
                  Start empty
                </button>
              </div>
            </details>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
        {tab === 'plan' && (
          <div className="mb-6">
            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">The most streaming for the least money</h1>
            <p className="mt-1 max-w-2xl text-slate-400">
              Pick who wants what and StreamView finds the cheapest mix of plans, family plans and bundles. It shows the by-the-rules
              setup next to the "everyone shares grandma's login" one, with an honest view of how hard each service clamps down.
            </p>
          </div>
        )}
        {tab === 'plan' && <PlanTab state={state} setState={setState} catalog={catalog} />}
        {tab === 'family' && <FamilyTab state={state} setState={setState} services={catalog.services} />}
        {tab === 'services' && <ServicesTab state={state} setState={setState} serviceById={catalog.serviceById} />}
      </main>

      <footer className="mx-auto max-w-6xl px-4 pb-10 text-xs text-slate-600">
        Your data stays in this browser. StreamView isn't affiliated with any streaming service.
      </footer>
    </div>
  )
}
