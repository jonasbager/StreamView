import type {
  Answers,
  BoardPackage,
  Enforcement,
  Household,
  Member,
  Product,
  ProductCategory,
  Provider,
  Service,
} from '@/db/schema'
import { ENFORCEMENT_RANK } from './rules'

/** Everything the engine needs, already loaded from the database. */
export interface Ctx {
  services: Service[]
  providers: Provider[]
  products: Product[]
  households: Household[]
  members: Member[]
  /** Share of people watching a shared video login at the same time. */
  concurrency?: number
}

export const KEEP_PREFIX = 'keep:'

/** A product the engine can price: a real catalog product or "keep what I have". */
export interface Priced {
  id: string
  name: string
  providerName: string
  category: ProductCategory
  monthly: number
  /** Cost in the first 12 months, incl. intro price and setup fee. */
  firstYear: number
  bindingMonths: number
  includes: Product['includes']
  attributes: Product['attributes']
  verified: boolean
  keep?: { memberId: string; kind: KeepKind; serviceId?: string }
  /** An official extra-member slot for this service (allows one person outside the home). */
  extraFor?: string
  offerText?: string | null
}

export type KeepKind = 'mobile' | 'broadband' | 'tv' | 'streaming'
export const EXTRA_SUFFIX = '#extra'

export function firstYear(p: Pick<Product, 'price' | 'introPrice' | 'introMonths' | 'setupFee'>) {
  const introMonths = Math.min(12, p.introMonths ?? 0)
  const intro = p.introPrice ?? p.price
  return intro * introMonths + p.price * (12 - introMonths) + p.setupFee
}

const emptyAnswers: Answers = {
  paysFor: [],
  wants: [],
  mobile: null,
  broadband: null,
  tv: null,
  willingToSwitch: 'if-worth-it',
  dataNeed: 'mid',
  adsOk: true,
  student: false,
}
export const answersOf = (m: Member): Answers => ({ ...emptyAnswers, ...(m.answers ?? {}) })

export class Catalog {
  readonly service = new Map<string, Service>()
  readonly provider = new Map<string, Provider>()
  readonly product = new Map<string, Product>()
  constructor(readonly ctx: Ctx) {
    for (const s of ctx.services) this.service.set(s.id, s)
    for (const p of ctx.providers) this.provider.set(p.id, p)
    for (const p of ctx.products) this.product.set(p.id, p)
  }

  /** Resolve a board product id (incl. keep:… ids) to something priceable. */
  priced(id: string): Priced | null {
    if (id.startsWith(KEEP_PREFIX)) return this.keepItem(id)
    if (id.endsWith(EXTRA_SUFFIX)) {
      const base = this.product.get(id.slice(0, -EXTRA_SUFFIX.length))
      const em = base?.attributes.extraMember
      if (!base || !em) return null
      const sid = base.includes[0]?.serviceId
      return {
        id, name: 'Ekstra medlem', providerName: this.provider.get(base.providerId)?.name ?? base.providerId, category: 'streaming',
        monthly: em.price, firstYear: em.price * 12, bindingMonths: 0, includes: sid ? [{ serviceId: sid, capacity: 1 }] : [],
        attributes: {}, verified: base.verifiedAt != null, extraFor: sid,
      }
    }
    const p = this.product.get(id)
    if (!p) return null
    return {
      id,
      name: p.name,
      providerName: this.provider.get(p.providerId)?.name ?? p.providerId,
      category: p.category,
      monthly: p.introPrice != null && (p.introMonths ?? 0) > 0 ? p.introPrice : p.price,
      firstYear: firstYear(p),
      bindingMonths: p.bindingMonths,
      includes: p.includes,
      attributes: p.attributes,
      verified: p.verifiedAt != null,
      offerText: p.offerText,
    }
  }

  /** keep:<kind>:<memberId>[:<serviceId>] — keep a current subscription at the price the person reported. */
  private keepItem(id: string): Priced | null {
    const [, kind, memberId, serviceId] = id.split(':') as [string, KeepKind, string, string?]
    const m = this.ctx.members.find((x) => x.id === memberId)
    if (!m) return null
    const a = answersOf(m)
    if (kind === 'streaming') {
      const pay = a.paysFor.find((x) => x.serviceId === serviceId)
      const svc = serviceId ? this.service.get(serviceId) : undefined
      if (!pay || !svc) return null
      const monthly = pay.monthly ?? this.cheapestPrice(svc.id)
      return {
        id, name: 'Nuværende abonnement', providerName: svc.name, category: 'streaming', monthly, firstYear: monthly * 12,
        bindingMonths: 0, includes: [{ serviceId: svc.id, capacity: svc.capacityType === 'seats' ? 1 : 2 }], attributes: {}, verified: true,
        keep: { memberId, kind, serviceId },
      }
    }
    const bill = a[kind]
    if (!bill) return null
    const providerName = bill.providerId ? this.provider.get(bill.providerId)?.name ?? bill.providerId : bill.other || 'Ukendt'
    const label = kind === 'mobile' ? 'Mobil' : kind === 'broadband' ? 'Internet' : 'TV'
    const monthly = bill.monthly ?? 0
    return {
      id, name: `${label} (nuværende)`, providerName, category: kind, monthly, firstYear: monthly * 12,
      bindingMonths: bill.bindingLeft ?? 0, includes: [], attributes: {}, verified: true, keep: { memberId, kind },
    }
  }

  cheapestPrice(serviceId: string) {
    const prices = this.ctx.products.filter((p) => p.active && p.category === 'streaming' && p.includes.some((i) => i.serviceId === serviceId)).map((p) => p.price)
    return prices.length ? Math.min(...prices) : 0
  }
}

// ---------------------------------------------------------------------------
// Evaluating a board (any set of packages)
// ---------------------------------------------------------------------------

export interface PackageWarning {
  level: 'info' | 'warn' | 'risk'
  text: string
}

export interface PackageResult {
  id: string
  monthly: number
  firstYear: number
  items: Priced[]
  /** Services this package covers. */
  services: string[]
  crossHome: boolean
  risk: Enforcement
  riskyServices: string[]
  warnings: PackageWarning[]
}

export interface BoardResult {
  packages: PackageResult[]
  monthly: number
  firstYear: number
  current: number
  saving: number
  /** member -> services they want but no package of theirs covers. */
  missing: { memberId: string; serviceId: string }[]
  /** Members who have a mobile/broadband today but no package covering it. */
  missingTelco: { memberId: string; kind: 'mobile' | 'broadband' | 'tv' }[]
  perMember: Record<string, number>
  perHousehold: Record<string, number>
  maxRisk: Enforcement
}

function demand(capacityType: 'streams' | 'seats', users: number, concurrency: number) {
  if (users === 0) return 0
  return capacityType === 'seats' ? users : Math.max(1, Math.ceil(users * concurrency - 1e-9))
}

export function evaluate(cat: Catalog, packages: BoardPackage[]): BoardResult {
  const { members, households } = cat.ctx
  const concurrency = cat.ctx.concurrency ?? 0.5
  const memberById = new Map(members.map((m) => [m.id, m]))
  const results: PackageResult[] = []

  for (const pkg of packages) {
    const items = pkg.productIds.map((id) => cat.priced(id)).filter((x): x is Priced => !!x)
    const users = pkg.memberIds.filter((id) => memberById.has(id))
    const homes = new Set(users.map((id) => memberById.get(id)!.householdId))
    homes.add(pkg.householdId)
    const crossHome = homes.size > 1
    const warnings: PackageWarning[] = []

    // Capacity per service across the package's items.
    const capacity = new Map<string, number>()
    for (const it of items) for (const inc of it.includes) capacity.set(inc.serviceId, (capacity.get(inc.serviceId) ?? 0) + inc.capacity)
    const services = [...capacity.keys()]

    const riskyServices: string[] = []
    let risk: Enforcement = 'none'
    for (const sid of services) {
      const svc = cat.service.get(sid)
      if (!svc) continue
      const wantingIds = users.filter((u) => answersOf(memberById.get(u)!).wants.includes(sid))
      const svcUsers = wantingIds.length ? wantingIds : users
      const need = demand(svc.capacityType, svcUsers.length, concurrency)
      const cap = capacity.get(sid) ?? 0
      if (need > cap) {
        warnings.push({
          level: 'warn',
          text:
            svc.capacityType === 'seats'
              ? `${svc.name}: ${svcUsers.length} personer, men kun plads til ${cap}.`
              : `${svc.name}: ${svcUsers.length} brugere deler ${cap} samtidige streams. Der kan blive kø.`,
        })
      }
      if (!svc.sharing.householdOnly) continue
      const outside = svcUsers.filter((u) => memberById.get(u)!.householdId !== pkg.householdId).length
      const extraSlots = items.filter((i) => i.extraFor === sid).length
      if (outside > extraSlots) {
        riskyServices.push(sid)
        if (ENFORCEMENT_RANK[svc.sharing.enforcement] > ENFORCEMENT_RANK[risk]) risk = svc.sharing.enforcement
      }
    }
    if (riskyServices.length) {
      warnings.push({
        level: 'risk',
        text: `Deles på tværs af husstande: ${riskyServices.map((s) => cat.service.get(s)!.name).join(', ')}. Det er imod tjenestens vilkår.`,
      })
    }

    // Telco items that are per person / per household.
    const mobileLines = items.filter((i) => i.category === 'mobile').reduce((n, i) => n + (i.attributes.lines ?? 1), 0)
    const broadband = items.filter((i) => i.category === 'broadband').length
    if (broadband > 1) warnings.push({ level: 'info', text: 'Flere internetforbindelser i samme pakke.' })
    if (mobileLines > 0 && mobileLines < users.length && items.every((i) => i.category === 'mobile'))
      warnings.push({ level: 'info', text: `${mobileLines} mobilabonnement(er) til ${users.length} personer.` })

    const unverified = items.filter((i) => !i.verified)
    if (unverified.length) warnings.push({ level: 'info', text: 'Nogle priser er ikke bekræftet endnu.' })
    const binding = Math.max(0, ...items.map((i) => i.bindingMonths))
    if (binding > 0) warnings.push({ level: 'info', text: `Binding: ${binding} måneder.` })

    results.push({
      id: pkg.id,
      monthly: items.reduce((s, i) => s + i.monthly, 0),
      firstYear: items.reduce((s, i) => s + i.firstYear, 0),
      items,
      services,
      crossHome,
      risk,
      riskyServices,
      warnings,
    })
  }

  // Coverage
  const missing: BoardResult['missing'] = []
  const missingTelco: BoardResult['missingTelco'] = []
  const perMember: Record<string, number> = Object.fromEntries(members.map((m) => [m.id, 0]))
  const perHousehold: Record<string, number> = Object.fromEntries(households.map((h) => [h.id, 0]))
  for (const [i, pkg] of packages.entries()) {
    const r = results[i]
    perHousehold[pkg.householdId] = (perHousehold[pkg.householdId] ?? 0) + r.monthly
    const users = pkg.memberIds.filter((id) => memberById.has(id))
    for (const u of users) perMember[u] += r.monthly / users.length
  }
  for (const m of members) {
    const a = answersOf(m)
    const mine = packages.map((p, i) => ({ p, r: results[i] })).filter(({ p }) => p.memberIds.includes(m.id))
    for (const sid of a.wants) {
      if (cat.service.get(sid)?.category === 'free') continue
      if (!mine.some(({ r }) => r.services.includes(sid))) missing.push({ memberId: m.id, serviceId: sid })
    }
    if (a.mobile && !mine.some(({ r }) => r.items.some((it) => it.category === 'mobile'))) missingTelco.push({ memberId: m.id, kind: 'mobile' })
  }
  for (const h of households) {
    const homeMembers = members.filter((m) => m.householdId === h.id)
    const hasBroadband = homeMembers.some((m) => answersOf(m).broadband)
    const homePackages = packages.map((p, i) => ({ p, r: results[i] })).filter(({ p }) => p.householdId === h.id)
    if (hasBroadband && !homePackages.some(({ r }) => r.items.some((it) => it.category === 'broadband'))) {
      const first = homeMembers.find((m) => answersOf(m).broadband)!
      missingTelco.push({ memberId: first.id, kind: 'broadband' })
    }
  }

  const monthly = results.reduce((s, r) => s + r.monthly, 0)
  const current = currentSpend(cat)
  const maxRisk = results.reduce<Enforcement>((acc, r) => (ENFORCEMENT_RANK[r.risk] > ENFORCEMENT_RANK[acc] ? r.risk : acc), 'none')
  return {
    packages: results,
    monthly,
    firstYear: results.reduce((s, r) => s + r.firstYear, 0),
    current,
    saving: current - monthly,
    missing,
    missingTelco,
    perMember,
    perHousehold,
    maxRisk,
  }
}

/** What the family pays today, from their answers. Broadband and TV are counted once per household. */
export function currentSpend(cat: Catalog) {
  let total = 0
  const homeBroadband = new Map<string, number>()
  const homeTv = new Map<string, number>()
  for (const m of cat.ctx.members) {
    const a = answersOf(m)
    for (const p of a.paysFor) total += p.monthly ?? cat.cheapestPrice(p.serviceId)
    total += a.mobile?.monthly ?? 0
    if (a.broadband?.monthly) homeBroadband.set(m.householdId, Math.max(homeBroadband.get(m.householdId) ?? 0, a.broadband.monthly))
    if (a.tv?.monthly) homeTv.set(m.householdId, Math.max(homeTv.get(m.householdId) ?? 0, a.tv.monthly))
  }
  for (const v of homeBroadband.values()) total += v
  for (const v of homeTv.values()) total += v
  return total
}

// ---------------------------------------------------------------------------
// Optimiser: builds a suggested board
// ---------------------------------------------------------------------------

interface Option {
  id: string
  price: number
  capacity: Map<string, number>
  product: Product
}

interface Unit {
  householdId: string
  /** serviceId -> member ids */
  needs: Map<string, string[]>
}

function solve(unit: Unit, options: Option[], cat: Catalog, concurrency: number, allowed: (o: Option) => boolean) {
  const needed = [...unit.needs.keys()]
  const n = needed.length
  if (n === 0) return [] as { option: Option; copies: number; services: string[] }[]
  const idx = new Map(needed.map((s, i) => [s, i]))
  const cands: { option: Option; mask: number; copies: number; cost: number }[] = []
  for (const o of options) {
    if (!allowed(o)) continue
    let mask = 0
    let copies = 0
    for (const [sid, cap] of o.capacity) {
      const i = idx.get(sid)
      if (i === undefined) continue
      mask |= 1 << i
      const svc = cat.service.get(sid)!
      copies = Math.max(copies, Math.ceil(demand(svc.capacityType, unit.needs.get(sid)!.length, concurrency) / Math.max(1, cap)))
    }
    if (!mask) continue
    copies = Math.max(1, copies)
    cands.push({ option: o, mask, copies, cost: o.price * copies })
  }
  const full = (1 << n) - 1
  const dp = new Array<number>(full + 1).fill(Infinity)
  const from = new Array<number>(full + 1).fill(-1)
  const via = new Array<number>(full + 1).fill(-1)
  dp[0] = 0
  for (let m = 0; m <= full; m++) {
    if (dp[m] === Infinity) continue
    for (let c = 0; c < cands.length; c++) {
      const next = m | cands[c].mask
      if (next !== m && dp[m] + cands[c].cost < dp[next] - 1e-9) {
        dp[next] = dp[m] + cands[c].cost
        from[next] = m
        via[next] = c
      }
    }
  }
  let best = full
  if (dp[full] === Infinity) {
    best = 0
    for (let m = 0; m <= full; m++) if (dp[m] < Infinity && bits(m) > bits(best)) best = m
  }
  const out: { option: Option; copies: number; services: string[] }[] = []
  for (let m = best; m > 0 && via[m] !== -1; m = from[m]) {
    const c = cands[via[m]]
    const newly = c.mask & ~from[m]
    out.push({ option: c.option, copies: c.copies, services: needed.filter((_, i) => (newly >> i) & 1) })
  }
  return out
}

const bits = (x: number) => {
  let c = 0
  for (; x; x &= x - 1) c++
  return c
}

const canPool = (svc: Service, tolerance: number) =>
  !svc.sharing.householdOnly || ENFORCEMENT_RANK[svc.sharing.enforcement] <= tolerance

let seq = 0
const pid = () => `p${Date.now().toString(36)}${(seq++).toString(36)}`

/**
 * mode 'legal': only share where the terms allow.
 * mode 'bend': also share across homes for services enforced at or below `tolerance`.
 */
export function optimise(cat: Catalog, mode: 'legal' | 'bend', tolerance: Enforcement = 'high'): BoardPackage[] {
  const { members, households } = cat.ctx
  const concurrency = cat.ctx.concurrency ?? 0.5
  const tol = mode === 'legal' ? 0 : ENFORCEMENT_RANK[tolerance]
  const memberById = new Map(members.map((m) => [m.id, m]))
  const packages: BoardPackage[] = []
  const name = (hid: string) => households.find((h) => h.id === hid)?.name ?? 'Hjem'

  const streamOptions = (unitMembers: string[]): Option[] => {
    const answers = unitMembers.map((id) => answersOf(memberById.get(id)!))
    const adsOk = answers.every((a) => a.adsOk)
    const allStudents = answers.length === 1 && answers[0].student
    return cat.ctx.products
      .filter((p) => p.active && (p.category === 'streaming' || p.category === 'bundle') && p.includes.length)
      .filter((p) => adsOk || !p.attributes.ads)
      .filter((p) => !p.attributes.requires || (p.attributes.requires === 'student' && allStudents))
      .map((p) => ({ id: p.id, price: p.price, capacity: new Map(p.includes.map((i) => [i.serviceId, i.capacity])), product: p }))
  }

  // --- Streaming: who keeps what, per home and pooled
  const homeNeeds = new Map(households.map((h) => [h.id, new Map<string, string[]>()]))
  const poolNeeds = new Map<string, string[]>()
  const keepers = new Map<string, string[]>() // memberId -> keep ids
  for (const m of members) {
    const a = answersOf(m)
    for (const sid of a.wants) {
      const svc = cat.service.get(sid)
      if (!svc || svc.category === 'free') continue
      // People who won't switch keep their current streaming as it is.
      if (a.willingToSwitch === 'no' && a.paysFor.some((p) => p.serviceId === sid)) {
        keepers.set(m.id, [...(keepers.get(m.id) ?? []), `${KEEP_PREFIX}streaming:${m.id}:${sid}`])
        continue
      }
      const target = canPool(svc, tol) ? poolNeeds : homeNeeds.get(m.householdId)!
      target.set(sid, [...(target.get(sid) ?? []), m.id])
    }
  }

  const addStreaming = (unit: Unit, allowed: (o: Option) => boolean, label: string) => {
    const users = [...new Set([...unit.needs.values()].flat())]
    const chosen = solve(unit, streamOptions(users), cat, concurrency, allowed)
    for (const ch of chosen) {
      const pkgUsers = [...new Set(ch.services.flatMap((s) => unit.needs.get(s) ?? []))]
      // Personal accounts (capacity 1 seats) are bought per person, not shared.
      const personal = [...ch.option.capacity].every(([sid, cap]) => cat.service.get(sid)?.capacityType === 'seats' && cap === 1)
      if (personal) {
        for (const u of pkgUsers) {
          packages.push({ id: pid(), name: label, householdId: memberById.get(u)!.householdId, productIds: [ch.option.id], memberIds: [u] })
        }
        continue
      }
      const homeCount = new Map<string, number>()
      for (const u of pkgUsers) homeCount.set(memberById.get(u)!.householdId, (homeCount.get(memberById.get(u)!.householdId) ?? 0) + 1)
      const payer = [...homeCount].sort((a, b) => b[1] - a[1])[0]?.[0] ?? unit.householdId
      packages.push({
        id: pid(),
        name: label,
        householdId: payer,
        productIds: Array(ch.copies).fill(ch.option.id),
        memberIds: pkgUsers,
      })
    }
  }

  for (const h of households) addStreaming({ householdId: h.id, needs: homeNeeds.get(h.id)! }, () => true, `Streaming · ${name(h.id)}`)
  addStreaming(
    { householdId: households[0]?.id ?? '', needs: poolNeeds },
    (o) => o.product.includes.every((i) => {
      const s = cat.service.get(i.serviceId)
      return !s || canPool(s, tol)
    }),
    mode === 'legal' ? 'Delt i familien' : 'Delt på tværs',
  )

  // Netflix-style extra members: replace a home's own plan with a slot on another home's plan when cheaper (legal).
  applyExtraMembers(cat, packages)

  // Merge streaming packages per home into one tidy package each (pooled ones stay separate).
  const merged = mergeByHome(packages, (hid) => `Streaming · ${name(hid)}`)

  // Keepers
  for (const [mid, ids] of keepers) {
    merged.push({ id: pid(), name: `Beholder · ${memberById.get(mid)!.name}`, householdId: memberById.get(mid)!.householdId, productIds: ids, memberIds: [mid] })
  }

  // --- Telco
  const mobileProducts = cat.ctx.products.filter((p) => p.active && p.category === 'mobile')
  const broadbandProducts = cat.ctx.products.filter((p) => p.active && p.category === 'broadband')
  for (const h of households) {
    const home = members.filter((m) => m.householdId === h.id)
    const ids: string[] = []
    const users: string[] = []
    for (const m of home) {
      const a = answersOf(m)
      if (!a.mobile) continue
      users.push(m.id)
      const minData = a.dataNeed === 'low' ? 0 : a.dataNeed === 'mid' ? 30 : 100
      const best = mobileProducts
        .filter((p) => (p.attributes.lines ?? 1) === 1 && ((p.attributes.dataGb ?? 0) === -1 || (p.attributes.dataGb ?? 0) >= minData))
        .sort((x, y) => firstYear(x) - firstYear(y))[0]
      const keepId = `${KEEP_PREFIX}mobile:${m.id}`
      const current = a.mobile.monthly ?? Infinity
      const switching = a.willingToSwitch === 'yes' || (a.willingToSwitch === 'if-worth-it' && best && current - best.price >= 30)
      ids.push(switching && best && best.price < current ? best.id : keepId)
    }
    const bbOwner = home.find((m) => answersOf(m).broadband)
    if (bbOwner) {
      const a = answersOf(bbOwner)
      const best = broadbandProducts.filter((p) => (p.attributes.speedMbit ?? 0) >= 500).sort((x, y) => firstYear(x) - firstYear(y))[0]
      const current = a.broadband!.monthly ?? Infinity
      const switching = a.willingToSwitch === 'yes' || (a.willingToSwitch === 'if-worth-it' && best && current - best.price >= 40)
      ids.push(switching && best && best.price < current && (a.broadband!.bindingLeft ?? 0) === 0 ? best.id : `${KEEP_PREFIX}broadband:${bbOwner.id}`)
    }
    const tvOwner = home.find((m) => answersOf(m).tv)
    if (tvOwner) ids.push(`${KEEP_PREFIX}tv:${tvOwner.id}`)
    if (ids.length) merged.push({ id: pid(), name: `Mobil & internet · ${h.name}`, householdId: h.id, productIds: ids, memberIds: users.length ? users : home.map((m) => m.id) })
  }
  return merged
}

function applyExtraMembers(cat: Catalog, packages: BoardPackage[]) {
  const memberById = new Map(cat.ctx.members.map((m) => [m.id, m]))
  for (const pkg of [...packages]) {
    if (pkg.productIds.length !== 1) continue
    const product = cat.product.get(pkg.productIds[0])
    if (!product || product.category !== 'streaming') continue
    const sid = product.includes[0]?.serviceId
    const host = packages.find(
      (p) => p !== pkg && p.householdId !== pkg.householdId && p.productIds.some((id) => {
        const hp = cat.product.get(id)
        return hp?.attributes.extraMember && hp.includes[0]?.serviceId === sid
      }),
    )
    if (!host) continue
    const hp = cat.product.get(host.productIds.find((id) => cat.product.get(id)?.attributes.extraMember)!)!
    const slots = hp.attributes.extraMember!.slots - host.memberIds.filter((m) => memberById.get(m)!.householdId !== host.householdId).length
    if (pkg.memberIds.length > slots) continue
    if (pkg.memberIds.length * hp.attributes.extraMember!.price >= product.price) continue
    // Move people onto the host plan and pay for extra members; the extra-member fee is modelled as a product row.
    host.memberIds.push(...pkg.memberIds)
    for (let i = 0; i < pkg.memberIds.length; i++) host.productIds.push(`${hp.id}${EXTRA_SUFFIX}`)
    packages.splice(packages.indexOf(pkg), 1)
  }
}

function mergeByHome(packages: BoardPackage[], label: (hid: string) => string): BoardPackage[] {
  const out: BoardPackage[] = []
  const byHome = new Map<string, BoardPackage>()
  for (const p of packages) {
    if (p.name.startsWith('Streaming ·') || p.name.startsWith('Delt')) {
      const existing = byHome.get(p.householdId)
      if (existing) {
        existing.productIds.push(...p.productIds)
        existing.memberIds = [...new Set([...existing.memberIds, ...p.memberIds])]
        continue
      }
      const copy = { ...p, name: label(p.householdId), productIds: [...p.productIds], memberIds: [...p.memberIds] }
      byHome.set(p.householdId, copy)
      out.push(copy)
    } else out.push(p)
  }
  return out
}
