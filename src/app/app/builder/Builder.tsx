'use client'

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { BrandMark } from '@/components/BrandMark'
import { ProductDetails } from '@/components/ProductDetails'
import { Person, personColor, RiskPill } from '@/components/ui'
import type { BoardPackage, FamilySettings, ProductCategory } from '@/db/schema'
import { answersOf, Catalog, EXTRA_SUFFIX, evaluate, KEEP_PREFIX, optimise, suggest, suggestionMeta, withChoices, type Ctx, type Priced, type Suggestion } from '@/lib/engine'
import { CATEGORY_DA, kr } from '@/lib/format'
import { findAiMoves, saveBoard, saveSettings } from '../actions'

type Drag = { type: 'product'; id: string; from?: string } | { type: 'person'; id: string; from?: string }
type Tab = 'streaming' | 'audio' | 'bundle' | 'mobile' | 'broadband' | 'tv' | 'current'

const TABS: { id: Tab; label: string }[] = [
  { id: 'streaming', label: 'Streaming' },
  { id: 'audio', label: 'Lyd' },
  { id: 'bundle', label: 'Pakker' },
  { id: 'mobile', label: 'Mobil' },
  { id: 'broadband', label: 'Internet' },
  { id: 'tv', label: 'TV' },
  { id: 'current', label: 'Nuværende' },
]

const newId = () => crypto.randomUUID()

export function Builder({ ctx, initial, today, settings, savedAt }: { ctx: Ctx; initial: BoardPackage[]; today: BoardPackage[]; settings: FamilySettings; savedAt: string | null }) {
  const cat = useMemo(() => new Catalog(ctx), [ctx])
  const [packages, setPackagesRaw] = useState<BoardPackage[]>(initial)
  const [history, setHistory] = useState<BoardPackage[][]>([])
  const [side, setSide] = useState<'ideas' | 'add'>('ideas')
  const [budget, setBudget] = useState<number | null>(settings.budget)
  const [ai, setAi] = useState<{ sig: string; list: Suggestion[] } | null>(null)
  const [aiError, setAiError] = useState(false)
  const [aiPending, startAi] = useTransition()
  // Every change goes through here so it can be undone.
  const setPackages = (next: BoardPackage[] | ((ps: BoardPackage[]) => BoardPackage[])) =>
    setPackagesRaw((ps) => {
      const n = typeof next === 'function' ? next(ps) : next
      if (n !== ps) setHistory((h) => [...h.slice(-30), ps])
      return n
    })
  const undo = () =>
    setHistory((h) => {
      if (!h.length) return h
      setPackagesRaw(h[h.length - 1])
      return h.slice(0, -1)
    })
  const [selected, setSelected] = useState<string | null>(initial[0]?.id ?? null)
  const [tab, setTab] = useState<Tab>('streaming')
  const [query, setQuery] = useState('')
  const [dragging, setDragging] = useState<Drag | null>(null)
  const [status, setStatus] = useState<'saved' | 'dirty' | 'saving' | 'error'>(savedAt ? 'saved' : 'dirty')
  const first = useRef(true)

  const result = useMemo(() => evaluate(cat, packages), [cat, packages])
  const todayCost = useMemo(() => evaluate(cat, today).monthly, [cat, today])
  const ideas = useMemo(() => suggest(cat, packages, { adsOk: settings.adsOk, allowBinding: settings.allowBinding }), [cat, packages, settings.adsOk, settings.allowBinding])
  const sig = suggestionMeta.signature(packages)
  const aiIdeas = ai && ai.sig === sig ? ai.list : []

  useEffect(() => {
    const t = setTimeout(() => {
      if (budget !== settings.budget) saveSettings({ ...settings, budget }).catch(() => {})
    }, 700)
    return () => clearTimeout(t)
  }, [budget]) // eslint-disable-line react-hooks/exhaustive-deps

  const askAi = () =>
    startAi(async () => {
      setAiError(false)
      try {
        const list = await findAiMoves({ packages }, ideas.map((i) => i.title))
        const known = new Set(ideas.map((i) => i.id.replace(/^ai-/, '')))
        setAi({ sig, list: list.filter((x) => !known.has(x.id.replace(/^ai-/, ''))) })
      } catch {
        setAiError(true)
      }
    })
  const memberIdx = useMemo(() => new Map(ctx.members.map((m, i) => [m.id, i])), [ctx.members])

  // Autosave
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    setStatus('dirty')
    const t = setTimeout(async () => {
      setStatus('saving')
      try {
        await saveBoard({ packages })
        setStatus('saved')
      } catch {
        setStatus('error')
      }
    }, 700)
    return () => clearTimeout(t)
  }, [packages])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor),
  )

  const update = (id: string, fn: (p: BoardPackage) => BoardPackage) => setPackages((ps) => ps.map((p) => (p.id === id ? fn(p) : p)))

  const addProduct = (pkgId: string | 'new', productId: string, from?: string) => {
    setPackages((ps) => {
      let next = ps
      if (from && from !== pkgId) {
        next = next.map((p) => (p.id === from ? { ...p, productIds: removeOne(p.productIds, productId) } : p))
      }
      if (from === pkgId) return ps
      if (pkgId === 'new') {
        const id = newId()
        const item = cat.priced(productId)
        setSelected(id)
        const keepMember = item?.keep?.memberId
        const home = keepMember ? ctx.members.find((m) => m.id === keepMember)!.householdId : ctx.households[0].id
        return [...next, { id, name: item ? `${item.providerName}` : 'Ny pakke', householdId: home, productIds: [productId], memberIds: keepMember ? [keepMember] : [] }]
      }
      return next.map((p) => (p.id === pkgId ? { ...p, productIds: [...p.productIds, productId] } : p))
    })
  }

  const addPerson = (pkgId: string, memberId: string, from?: string) => {
    if (pkgId === 'new') return
    setPackages((ps) =>
      ps.map((p) => {
        if (from && p.id === from && from !== pkgId) return { ...p, memberIds: p.memberIds.filter((m) => m !== memberId) }
        if (p.id === pkgId && !p.memberIds.includes(memberId)) return { ...p, memberIds: [...p.memberIds, memberId] }
        return p
      }),
    )
  }

  const onDragStart = (e: DragStartEvent) => setDragging(e.active.data.current as Drag)
  const onDragEnd = (e: DragEndEvent) => {
    setDragging(null)
    const d = e.active.data.current as Drag | undefined
    const target = e.over?.id as string | undefined
    if (!d) return
    if (!target) {
      // Dropped outside: remove from the package it came from.
      if (d.from) {
        if (d.type === 'product') update(d.from, (p) => ({ ...p, productIds: removeOne(p.productIds, d.id) }))
        else update(d.from, (p) => ({ ...p, memberIds: p.memberIds.filter((m) => m !== d.id) }))
      }
      return
    }
    if (target === 'trash') {
      if (d.from && d.type === 'product') update(d.from, (p) => ({ ...p, productIds: removeOne(p.productIds, d.id) }))
      if (d.from && d.type === 'person') update(d.from, (p) => ({ ...p, memberIds: p.memberIds.filter((m) => m !== d.id) }))
      return
    }
    if (d.type === 'product') addProduct(target, d.id, d.from)
    else addPerson(target, d.id, d.from)
  }

  const catalogItems = useMemo(() => {
    const q = query.trim().toLowerCase()
    let items: Priced[]
    if (tab === 'current') {
      items = ctx.members.flatMap((m) => {
        const a = answersOf(m)
        const ids = [
          ...a.paysFor.map((p) => `${KEEP_PREFIX}streaming:${m.id}:${p.serviceId}`),
          ...(a.mobile ? [`${KEEP_PREFIX}mobile:${m.id}`] : []),
          ...(a.broadband ? [`${KEEP_PREFIX}broadband:${m.id}`] : []),
          ...(a.tv ? [`${KEEP_PREFIX}tv:${m.id}`] : []),
        ]
        return ids.map((id) => cat.priced(id)).filter((x): x is Priced => !!x).map((x) => ({ ...x, name: `${m.name}: ${x.name}` }))
      })
    } else {
      const isAudio = (p: (typeof ctx.products)[number]) => p.includes.length > 0 && p.includes.every((i) => cat.service.get(i.serviceId)?.category === 'audio')
      items = ctx.products
        .filter((p) => (tab === 'audio' ? p.category === 'streaming' && isAudio(p) : p.category === (tab as ProductCategory) && !(tab === 'streaming' && isAudio(p))))
        .flatMap((p) => {
          const main = cat.priced(p.id)
          const extra = p.attributes.extraMember ? cat.priced(`${p.id}${EXTRA_SUFFIX}`) : null
          return [main, extra].filter((x): x is Priced => !!x)
        })
        .sort((a, b) => a.providerName.localeCompare(b.providerName, 'da') || a.monthly - b.monthly)
    }
    return q ? items.filter((i) => `${i.providerName} ${i.name}`.toLowerCase().includes(q)) : items
  }, [ctx, cat, tab, query])

  const resetTo = (next: BoardPackage[]) => {
    setPackages(next)
    setSelected(next[0]?.id ?? null)
  }

  const missingText = result.missing
    .map((m) => `${ctx.members.find((x) => x.id === m.memberId)?.name}: ${cat.service.get(m.serviceId)?.name}`)
    .concat(result.missingTelco.map((m) => `${ctx.members.find((x) => x.id === m.memberId)?.name}: ${{ mobile: 'mobil', broadband: 'internet', tv: 'tv' }[m.kind]}`))

  return (
    <DndContext id="package-builder" sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Jeres opsætning</h1>
          <p className="mt-1 max-w-2xl text-ink-2">
            Det her er, hvad I har i dag. Prøv forslagene, eller træk tjenester, mobil og internet rundt, og se med det samme, hvad det
            betyder for prisen.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-ink-3" aria-live="polite">
            {{ saved: 'Gemt', dirty: 'Ikke gemt', saving: 'Gemmer…', error: 'Kunne ikke gemme' }[status]}
          </span>
          <button className="btn-quiet btn-sm" onClick={undo} disabled={!history.length}>Fortryd</button>
          <button className="btn-quiet btn-sm" onClick={() => resetTo(today.map((p) => ({ ...p, id: newId() })))}>Tilbage til i dag</button>
          <button
            className="btn-quiet btn-sm"
            title="Den billigste opsætning, der giver alle deres ønsker, efter reglerne"
            onClick={() => resetTo(optimise(cat, 'legal', 'high', { adsOk: settings.adsOk, allowBinding: settings.allowBinding, switchTelco: settings.switchTelco }))}
          >
            Billigst med alle ønsker
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="card sticky top-[72px] z-30 mb-6 flex flex-wrap items-center gap-x-8 gap-y-3 px-5 py-4 shadow-[0_8px_24px_-16px_rgba(0,0,0,0.25)]">
        <Sum label="Pr. måned" value={kr(result.monthly)} strong />
        <Sum label="I dag" value={kr(todayCost)} />
        <Sum
          label={todayCost - result.monthly >= 0 ? 'I sparer' : 'Dyrere med'}
          value={kr(Math.abs(todayCost - result.monthly))}
          tone={todayCost - result.monthly >= 0 ? 'brand' : 'risk'}
        />
        <Sum label="Første år" value={kr(result.firstYear)} />
        <label className="text-xs text-ink-3">
          Vil højst bruge (valgfrit)
          <span className="mt-0.5 flex items-center gap-1">
            <input
              type="number"
              min={0}
              step={50}
              inputMode="numeric"
              value={budget ?? ''}
              placeholder="–"
              onChange={(e) => setBudget(e.target.value === '' ? null : Number(e.target.value))}
              className={`num h-8 w-24 rounded-lg border bg-card px-2 text-base font-medium text-ink outline-none focus:border-ink ${budget != null && result.monthly > budget ? 'border-risk' : 'border-line-2'}`}
            />
            {budget != null && (
              <span className={`text-sm ${result.monthly > budget ? 'text-risk' : 'text-brand'}`}>
                {result.monthly > budget ? `${kr(result.monthly - budget)} over` : `${kr(budget - result.monthly)} tilbage`}
              </span>
            )}
          </span>
        </label>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {result.maxRisk !== 'none' ? <RiskPill level={result.maxRisk} /> : <RiskPill level="none" label="Efter reglerne" />}
          {missingText.length > 0 && (
            <span className="rounded-full bg-warn-soft px-2.5 py-1 text-xs font-medium text-warn" title={missingText.join('\n')}>
              {missingText.length} mangler
            </span>
          )}
        </div>
      </div>

      <div className="grid min-w-0 gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
        {/* Catalog */}
        <aside className="min-w-0 space-y-4 lg:sticky lg:top-[168px] lg:max-h-[calc(100vh-190px)] lg:overflow-y-auto">
          <div className="flex rounded-full border border-line-2 bg-sunk p-0.5">
            {(
              [
                ['ideas', `Forslag${ideas.length + aiIdeas.length ? ` (${ideas.length + aiIdeas.length})` : ''}`],
                ['add', 'Tilføj selv'],
              ] as const
            ).map(([k, l]) => (
              <button key={k} onClick={() => setSide(k)} className={`flex-1 rounded-full px-3 py-1.5 text-sm transition ${side === k ? 'bg-card font-medium shadow-sm' : 'text-ink-2'}`}>
                {l}
              </button>
            ))}
          </div>
          {side === 'ideas' && (
            <Ideas ideas={ideas} aiIdeas={aiIdeas} aiPending={aiPending} aiError={aiError} onAsk={askAi} onApply={(sgg) => setPackages(sgg.board)} />
          )}
          {side === 'add' && (<>
          <div className="card p-4">
            <div className="eyebrow mb-3">Personer</div>
            <div className="flex flex-wrap gap-2">
              {ctx.members.map((m) => (
                <DraggablePerson key={m.id} id={m.id} name={m.name} color={personColor(memberIdx.get(m.id) ?? 0)} />
              ))}
            </div>
          </div>
          <div className="card p-4">
            <div className="-mx-1 mb-3 flex flex-wrap gap-1">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`rounded-full px-3 py-1 text-sm transition ${tab === t.id ? 'bg-ink text-paper' : 'text-ink-2 hover:bg-sunk'}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <input className="input mb-3 h-10" placeholder="Søg…" value={query} onChange={(e) => setQuery(e.target.value)} />
            <ul className="space-y-1.5">
              {catalogItems.map((it) => (
                <li key={it.id}>
                  <DraggableProduct uid={it.id} item={it} cat={cat} onAdd={selected ? () => addProduct(selected, it.id) : undefined} />
                </li>
              ))}
              {catalogItems.length === 0 && <li className="py-6 text-center text-sm text-ink-3">Intet her.</li>}
            </ul>
          </div>
          </>)}
        </aside>

        {/* Packages */}
        <section className="min-w-0 space-y-4">
          <div className="grid gap-4 xl:grid-cols-2">
            {packages.map((p, i) => (
              <PackageCard
                key={p.id}
                pkg={p}
                result={result.packages[i]}
                ctx={ctx}
                cat={cat}
                memberIdx={memberIdx}
                selected={selected === p.id}
                onSelect={() => setSelected(p.id)}
                onChange={(fn) => update(p.id, fn)}
                onDelete={() => setPackages((ps) => ps.filter((x) => x.id !== p.id))}
              />
            ))}
            <NewPackageZone
              onClick={() => {
                const id = newId()
                setPackages((ps) => [...ps, { id, name: 'Ny pakke', householdId: ctx.households[0].id, productIds: [], memberIds: [] }])
                setSelected(id)
              }}
            />
          </div>
          <TrashZone visible={!!dragging?.from} />
        </section>
      </div>

      <DragOverlay dropAnimation={{ duration: 160, easing: 'cubic-bezier(.2,.8,.2,1)' }}>
        {dragging?.type === 'product' && (() => {
          const it = cat.priced(dragging.id)
          return it ? <ProductRow item={it} cat={cat} lifted /> : null
        })()}
        {dragging?.type === 'person' && (() => {
          const m = ctx.members.find((x) => x.id === dragging.id)
          return m ? <PersonChip name={m.name} color={personColor(memberIdx.get(m.id) ?? 0)} lifted /> : null
        })()}
      </DragOverlay>
    </DndContext>
  )
}

function removeOne(list: string[], id: string) {
  const i = list.indexOf(id)
  return i === -1 ? list : [...list.slice(0, i), ...list.slice(i + 1)]
}

function Ideas({ ideas, aiIdeas, aiPending, aiError, onAsk, onApply }: { ideas: Suggestion[]; aiIdeas: Suggestion[]; aiPending: boolean; aiError: boolean; onAsk: () => void; onApply: (s: Suggestion) => void }) {
  const save = [...aiIdeas.filter((s) => s.group === 'save'), ...ideas.filter((s) => s.group === 'save')].slice(0, 8)
  const more = [...aiIdeas.filter((s) => s.group === 'more'), ...ideas.filter((s) => s.group === 'more')].sort((a, b) => b.saving - a.saving).slice(0, 5)
  const bend = ideas.filter((s) => s.group === 'bend').slice(0, 4)
  const aiIds = new Set(aiIdeas.map((s) => s.id))
  return (
    <div className="space-y-4">
      <IdeaGroup title="Spar penge" empty="Vi kan ikke finde flere besparelser efter reglerne. Prøv AI herunder." list={save} aiIds={aiIds} onApply={onApply} />
      <div className="card p-4">
        <button className="btn-quiet btn-sm w-full" onClick={onAsk} disabled={aiPending}>
          {aiPending ? 'AI leder efter besparelser…' : 'Find flere besparelser med AI'}
        </button>
        <p className="mt-2 text-xs text-ink-3">
          {aiError ? 'AI kunne ikke svare lige nu. Prøv igen.' : 'AI foreslår træk; vi regner prisen ud og viser kun dem, der faktisk sparer.'}
        </p>
      </div>
      {more.length > 0 && <IdeaGroup title="Få flere ønsker opfyldt" list={more} aiIds={aiIds} onApply={onApply} />}
      {bend.length > 0 && (
        <IdeaGroup title="Grå zone: del med andre hjem" note="Ikke ulovligt, men imod tjenestens vilkår." list={bend} aiIds={aiIds} onApply={onApply} />
      )}
    </div>
  )
}

function IdeaGroup({ title, note, empty, list, aiIds, onApply }: { title: string; note?: string; empty?: string; list: Suggestion[]; aiIds: Set<string>; onApply: (s: Suggestion) => void }) {
  return (
    <section className="card p-4">
      <h3 className="font-semibold">{title}</h3>
      {note && <p className="text-xs text-ink-3">{note}</p>}
      {list.length === 0 && empty && <p className="mt-2 text-sm text-ink-3">{empty}</p>}
      <ul className="mt-3 space-y-2">
        {list.map((s) => (
          <li key={s.id} className="rounded-xl border border-line p-3">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-[15px] leading-snug font-medium">
                  {aiIds.has(s.id) && <span className="mr-1.5 rounded bg-sunk px-1.5 py-0.5 align-middle text-[10px] font-semibold text-ink-2">AI</span>}
                  {s.title}
                </div>
                {s.detail && <p className="mt-1 text-xs leading-relaxed text-ink-3">{s.detail}</p>}
                {s.risk !== 'none' && <div className="mt-2"><RiskPill level={s.risk} /></div>}
              </div>
              <div className="shrink-0 text-right">
                <div className={`num text-sm font-semibold ${s.saving >= 0 ? 'text-brand' : 'text-ink-2'}`}>
                  {s.saving >= 0 ? `−${kr(s.saving)}` : `+${kr(-s.saving)}`}
                </div>
                <div className="text-[11px] text-ink-3">pr. md.</div>
              </div>
            </div>
            <button className="btn-quiet btn-sm mt-2 w-full" onClick={() => onApply(s)}>Prøv det</button>
          </li>
        ))}
      </ul>
    </section>
  )
}

function Sum({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: 'brand' | 'risk' }) {
  return (
    <div>
      <div className="text-xs text-ink-3">{label}</div>
      <div className={`num tracking-tight ${strong ? 'text-2xl font-semibold' : 'text-lg font-medium'} ${tone === 'brand' ? 'text-brand' : tone === 'risk' ? 'text-risk' : ''}`}>
        {value}
      </div>
    </div>
  )
}

function serviceColor(it: Priced, cat: Catalog) {
  const sid = it.includes[0]?.serviceId
  return (sid && cat.service.get(sid)?.color) || cat.ctx.providers.find((p) => p.name === it.providerName)?.color || '#5d5a54'
}

function ProductRow({ item, cat, lifted, onAdd, onRemove, who, usedFor, onChoose }: { item: Priced; cat: Catalog; lifted?: boolean; onAdd?: () => void; onRemove?: () => void; who?: { text: string; warn?: boolean }; usedFor?: string[]; onChoose?: (services: string[]) => void }) {
  const [open, setOpen] = useState(false)
  const title = item.name.toLowerCase().startsWith(item.providerName.toLowerCase()) ? item.name : `${item.providerName} ${item.name}`
  const includesText = item.attributes.choose
    ? `Vælg ${item.attributes.choose.count} tjenester${usedFor?.length ? `: ${usedFor.map((s) => cat.service.get(s)?.name).join(', ')}` : ''}`
    : item.includes.length > 1
      ? `Med ${item.includes.map((i) => cat.service.get(i.serviceId)?.name).filter(Boolean).join(', ')}`
      : ''
  return (
    <div className={`group rounded-xl border bg-card px-3 py-2.5 ${lifted ? 'rotate-[0.6deg] border-ink shadow-xl' : 'border-line hover:border-line-2'}`}>
      <div className="flex items-center gap-3">
        <BrandMark id={item.logoId} name={item.providerName} color={serviceColor(item, cat)} size={30} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-medium" title={title}>{title}</div>
          <div className="truncate text-xs text-ink-3">
            {CATEGORY_DA[item.category]}
            {item.keep ? ' · nuværende' : ''}
            {item.attributes.ads ? ' · reklamer' : ''}
            {item.bindingMonths ? ` · ${item.bindingMonths} mdr. binding` : ''}
            {item.extraFor ? ' · 1 person uden for hjemmet' : ''}
            {!item.verified && ' · pris ikke bekræftet'}
          </div>
          {includesText && <div className="truncate text-xs text-ink-2">{includesText}</div>}
          {who && <div className={`truncate text-xs ${who.warn ? 'text-warn' : 'text-ink-2'}`}>{who.text}</div>}
        </div>
        <div className="num text-[15px] font-medium">{kr(item.monthly)}</div>
        {onAdd && (
          <button onClick={onAdd} className="grid size-7 place-items-center rounded-full text-ink-3 hover:bg-sunk hover:text-ink" aria-label="Tilføj til valgt pakke" title="Tilføj til valgt pakke">
            +
          </button>
        )}
        {onRemove && (
          <button onClick={onRemove} className="grid size-7 place-items-center rounded-full text-ink-3 opacity-0 group-hover:opacity-100 hover:bg-sunk hover:text-ink focus:opacity-100" aria-label="Fjern">
            ×
          </button>
        )}
      </div>
      {onChoose && item.attributes.choose && !lifted && (
        <ChoicePicker item={item} cat={cat} auto={usedFor ?? []} onChoose={onChoose} />
      )}
      {!lifted && (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="mt-1 text-xs text-ink-3 underline-offset-2 hover:text-ink hover:underline"
        >
          {open ? 'Skjul' : 'Hvad er med?'}
        </button>
      )}
      {open && <ProductDetails item={item} cat={cat} usedFor={usedFor} />}
    </div>
  )
}

function DraggableProduct({ uid, item, cat, onAdd, from, onRemove, who, usedFor, onChoose }: { uid: string; item: Priced; cat: Catalog; onAdd?: () => void; from?: string; onRemove?: () => void; who?: { text: string; warn?: boolean }; usedFor?: string[]; onChoose?: (services: string[]) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `product:${from ?? 'catalog'}:${uid}`,
    data: { type: 'product', id: item.id, from } satisfies Drag,
  })
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} className={`touch-manipulation cursor-grab active:cursor-grabbing ${isDragging ? 'opacity-30' : ''}`}>
      <ProductRow item={item} cat={cat} onAdd={onAdd} onRemove={onRemove} who={who} usedFor={usedFor} onChoose={onChoose} />
    </div>
  )
}

function PersonChip({ name, color, lifted, onRemove }: { name: string; color: string; lifted?: boolean; onRemove?: () => void }) {
  return (
    <span className={`group inline-flex items-center gap-1.5 rounded-full border bg-card py-1 pr-3 pl-1 text-sm ${lifted ? 'border-ink shadow-xl' : 'border-line-2'}`}>
      <Person name={name} color={color} size={24} />
      {name}
      {onRemove && (
        <button onClick={onRemove} className="-mr-1 ml-0.5 text-ink-3 hover:text-ink" aria-label={`Fjern ${name}`}>×</button>
      )}
    </span>
  )
}

function DraggablePerson({ id, name, color, from, onRemove }: { id: string; name: string; color: string; from?: string; onRemove?: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `person:${from ?? 'pool'}:${id}`,
    data: { type: 'person', id, from } satisfies Drag,
  })
  return (
    <span ref={setNodeRef} {...listeners} {...attributes} className={`touch-manipulation cursor-grab ${isDragging ? 'opacity-30' : ''}`}>
      <PersonChip name={name} color={color} onRemove={onRemove} />
    </span>
  )
}

function PackageCard({
  pkg,
  result,
  ctx,
  cat,
  memberIdx,
  selected,
  onSelect,
  onChange,
  onDelete,
}: {
  pkg: BoardPackage
  result: ReturnType<typeof evaluate>['packages'][number]
  ctx: Ctx
  cat: Catalog
  memberIdx: Map<string, number>
  selected: boolean
  onSelect: () => void
  onChange: (fn: (p: BoardPackage) => BoardPackage) => void
  onDelete: () => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: pkg.id })
  const items = pkg.productIds.map((id, i) => ({ key: `${id.split('@')[0]}-${i}`, id, index: i, item: cat.priced(id) }))
  return (
    <div
      ref={setNodeRef}
      onPointerDown={onSelect}
      className={`card flex min-w-0 flex-col p-5 transition ${isOver ? 'border-ink bg-sunk' : selected ? 'border-ink-3' : ''}`}
    >
      <div className="flex items-start gap-3">
        <input
          value={pkg.name}
          onChange={(e) => onChange((p) => ({ ...p, name: e.target.value }))}
          className="w-0 min-w-0 flex-1 bg-transparent text-[17px] font-semibold outline-none focus:underline"
          aria-label="Pakkens navn"
        />
        <div className="text-right">
          <div className="num text-xl font-semibold tracking-tight">{kr(result?.monthly ?? 0)}</div>
          <div className="text-xs text-ink-3">pr. måned</div>
        </div>
      </div>

      <label className="mt-1 flex items-center gap-1.5 text-sm text-ink-3">
        Betales af
        <select
          value={pkg.householdId}
          onChange={(e) => onChange((p) => ({ ...p, householdId: e.target.value }))}
          className="rounded-md bg-transparent font-medium text-ink-2 outline-none hover:text-ink"
        >
          {ctx.households.map((h) => (
            <option key={h.id} value={h.id}>{h.name}</option>
          ))}
        </select>
      </label>

      <div className="mt-4 flex min-h-9 flex-wrap items-center gap-1.5">
        {pkg.memberIds.map((mid) => {
          const m = ctx.members.find((x) => x.id === mid)
          if (!m) return null
          const away = m.householdId !== pkg.householdId
          return (
            <span key={mid} className="relative">
              <DraggablePerson
                id={mid}
                name={m.name}
                color={personColor(memberIdx.get(mid) ?? 0)}
                from={pkg.id}
                onRemove={() => onChange((p) => ({ ...p, memberIds: p.memberIds.filter((x) => x !== mid) }))}
              />
              {away && <span className="absolute -top-1 -right-0.5 size-2.5 rounded-full bg-warn ring-2 ring-card" title="Bor i et andet hjem" />}
            </span>
          )
        })}
        {pkg.memberIds.length === 0 && <span className="text-sm text-ink-3">Træk personer hertil</span>}
      </div>

      <div className="mt-3 space-y-1.5">
        {items.map(({ key, id, index, item }) =>
          item ? (
            <DraggableProduct
              key={key}
              uid={key}
              who={whoFor(item, pkg, ctx)}
              usedFor={result?.chosen[id]}
              onChoose={(services) => onChange((p) => ({ ...p, productIds: p.productIds.map((x, j) => (j === index ? withChoices(x, services) : x)) }))}
              item={item}
              cat={cat}
              from={pkg.id}
              onRemove={() => onChange((p) => ({ ...p, productIds: removeOne(p.productIds, id) }))}
            />
          ) : null,
        )}
        <div className={`rounded-xl border border-dashed px-3 py-3 text-center text-sm transition ${isOver ? 'border-ink text-ink' : 'border-line-2 text-ink-3'}`}>
          Træk tjenester, mobil eller internet hertil
        </div>
      </div>

      {result && result.warnings.length > 0 && (
        <ul className="mt-4 space-y-1.5 border-t border-line pt-3">
          {result.risk !== 'none' && (
            <li><RiskPill level={result.risk} /></li>
          )}
          {result.warnings.map((w) => (
            <li key={w.text} className={`text-sm ${w.level === 'risk' ? 'text-risk' : w.level === 'warn' ? 'text-warn' : 'text-ink-3'}`}>{w.text}</li>
          ))}
          {result.riskyServices.map((sid) => (
            <li key={sid} className="text-sm text-ink-2">
              <b className="font-medium text-ink">{cat.service.get(sid)?.name}:</b> {cat.service.get(sid)?.sharing.howEnforced}
            </li>
          ))}
        </ul>
      )}

      <button onClick={onDelete} className="mt-4 self-start text-sm text-ink-3 hover:text-risk">Slet pakke</button>
    </div>
  )
}

/** Pick which services a "choose N" package (CBB MIX, Telmore Play …) is used for. */
function ChoicePicker({ item, cat, auto, onChoose }: { item: Priced; cat: Catalog; auto: string[]; onChoose: (services: string[]) => void }) {
  const ch = item.attributes.choose!
  const mine = item.selected
  const current = mine ?? auto
  const toggle = (sid: string) => {
    const base = mine ?? auto
    // When all slots are taken, a new pick replaces the oldest one.
    const next = base.includes(sid) ? base.filter((x) => x !== sid) : [...base, sid].slice(-ch.count)
    onChoose(next)
  }
  return (
    <div className="mt-2 rounded-lg border border-line px-2.5 py-2" onPointerDown={(e) => e.stopPropagation()}>
      <div className="mb-1.5 flex items-center justify-between gap-2 text-xs">
        <span className="font-medium text-ink">
          {mine ? `Jeres valg: ${mine.length} af ${ch.count}` : `Vælg ${ch.count} tjenester`}
        </span>
        {mine ? (
          <button className="text-ink-3 hover:text-ink" onClick={() => onChoose([])}>Vælg automatisk</button>
        ) : (
          <span className="text-ink-3">{auto.length ? 'Forslag ud fra jeres ønsker' : 'Ingen valgt'}</span>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {ch.from.map((sid) => {
          const s = cat.service.get(sid)
          if (!s) return null
          const on = current.includes(sid)
          return (
            <button
              key={sid}
              type="button"
              onClick={() => toggle(sid)}
              aria-pressed={on}
              className={`inline-flex items-center gap-1.5 rounded-full border py-0.5 pr-2.5 pl-0.5 text-xs transition ${
                on ? (mine ? 'border-ink bg-ink text-paper' : 'border-dashed border-ink-3 bg-sunk text-ink') : 'border-line-2 text-ink-2 hover:border-ink-3'
              }`}
            >
              <BrandMark id={sid} name={s.name} color={s.color} size={18} />
              {s.name}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** Why an item is in a package: who wanted it, or who it's for. */
function whoFor(item: Priced, pkg: BoardPackage, ctx: Ctx): { text: string; warn?: boolean } | undefined {
  const name = (id: string) => ctx.members.find((m) => m.id === id)?.name ?? '?'
  if (item.keep) return { text: item.monthly === 0 && item.keep.kind === 'streaming' ? `${name(item.keep.memberId)} bruger den gratis` : `${name(item.keep.memberId)} betaler i dag` }
  if (item.category === 'mobile') return { text: 'Mobil til én person i pakken' }
  if (item.category === 'broadband' || item.category === 'tv') return { text: 'Til hele hjemmet' }
  const sids = item.includes.map((i) => i.serviceId)
  const wanting = pkg.memberIds.filter((m) => {
    const a = ctx.members.find((x) => x.id === m)?.answers
    return a?.wants.some((w) => sids.includes(w))
  })
  if (!wanting.length) return { text: 'Ingen i pakken har ønsket den', warn: true }
  return { text: `Ønsket af ${wanting.map(name).join(', ')}` }
}

function NewPackageZone({ onClick }: { onClick: () => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'new' })
  return (
    <button
      ref={setNodeRef}
      onClick={onClick}
      className={`grid min-h-40 place-items-center rounded-[var(--radius-card)] border-2 border-dashed text-[15px] transition ${isOver ? 'border-ink bg-sunk text-ink' : 'border-line-2 text-ink-3 hover:border-ink-3 hover:text-ink-2'}`}
    >
      + Ny pakke
      <span className="-mt-6 block text-sm">eller slip en tjeneste her</span>
    </button>
  )
}

function TrashZone({ visible }: { visible: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'trash' })
  return (
    <div
      ref={setNodeRef}
      className={`fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full border px-6 py-3 text-sm font-medium shadow-lg transition ${
        visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-4 opacity-0'
      } ${isOver ? 'border-risk bg-risk text-white' : 'border-line-2 bg-card text-ink-2'}`}
    >
      Slip her for at fjerne
    </div>
  )
}
