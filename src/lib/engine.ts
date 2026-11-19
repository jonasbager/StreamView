import type {
  Answers,
  PaidVia,
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
  providerId?: string
  /** Id used for the logo: the service for streaming items, else the provider. */
  logoId?: string
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
  /** For "choose N" products: the services the family picked (undefined = pick automatically). */
  selected?: string[]
  /** Details for the "what's included" fold-out. */
  info?: { price: number; introPrice: number | null; introMonths: number | null; setupFee: number; sourceUrl: string | null; verifiedAt: string | null; offerEndsAt: string | null }
}

export type KeepKind = 'mobile' | 'broadband' | 'tv' | 'streaming'
/** Separates a product id from the services picked in it. */
export const CHOICE_SEP = '@'
export const withChoices = (productId: string, services: string[]) =>
  services.length ? `${productId.split(CHOICE_SEP)[0]}${CHOICE_SEP}${services.join('+')}` : productId.split(CHOICE_SEP)[0]
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
        attributes: {}, verified: base.verifiedAt != null, extraFor: sid, providerId: base.providerId, logoId: sid,
      }
    }
    if (id.includes(CHOICE_SEP)) {
      // A "choose N" product with the services the family picked: productId@netflix+tv2play
      const [baseId, picked] = id.split(CHOICE_SEP)
      const base = this.priced(baseId)
      const ch = base?.attributes.choose
      if (!base || !ch) return base
      const selected = [...new Set(picked.split('+'))].filter((sid) => ch.from.includes(sid)).slice(0, ch.count)
      const cap = (sid: string) => ch.capacity ?? (this.service.get(sid)?.capacityType === 'seats' ? 1 : 2)
      return { ...base, id, includes: [...base.includes, ...selected.map((sid) => ({ serviceId: sid, capacity: cap(sid) }))], selected }
    }
    const p = this.product.get(id)
    if (!p) return null
    return {
      id,
      name: p.name,
      providerName: this.provider.get(p.providerId)?.name ?? p.providerId,
      providerId: p.providerId,
      logoId: p.category === 'streaming' && p.includes.length === 1 ? p.includes[0].serviceId : p.providerId,
      category: p.category,
      // Always the normal price; intro offers and free trials only count in firstYear.
      monthly: p.price,
      firstYear: firstYear(p),
      bindingMonths: p.bindingMonths,
      includes: p.includes,
      attributes: p.attributes,
      verified: p.verifiedAt != null,
      offerText: p.offerText,
      info: { price: p.price, introPrice: p.introPrice, introMonths: p.introMonths, setupFee: p.setupFee, sourceUrl: p.sourceUrl, verifiedAt: p.verifiedAt, offerEndsAt: p.offerEndsAt },
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
      const other = pay.via === 'other'
      const monthly = other ? 0 : pay.monthly ?? this.planPrice(pay.productId) ?? this.cheapestPrice(svc.id)
      return {
        id, name: other ? 'Betales af en anden' : (pay.productId ? this.product.get(pay.productId)?.name : undefined) ?? 'Abonnement', providerName: svc.name, logoId: svc.id, category: 'streaming', monthly, firstYear: monthly * 12,
        bindingMonths: 0, includes: this.currentPlanIncludes(svc, pay.productId, pay.monthly), attributes: {}, verified: true,
        keep: { memberId, kind, serviceId },
      }
    }
    const bill = a[kind]
    if (!bill) return null
    const providerName = bill.providerId ? this.provider.get(bill.providerId)?.name ?? bill.providerId : bill.other || 'Ukendt'
    const label = kind === 'mobile' ? 'Mobil' : kind === 'broadband' ? 'Internet' : 'TV'
    const monthly = bill.monthly ?? estimateBill(this, kind, bill.providerId)
    // Streaming included in this bill (e.g. HBO Max with the mobile plan).
    const homeMembers = kind === 'mobile' ? [m] : this.ctx.members.filter((x) => x.householdId === m.householdId)
    const included = [...new Set(homeMembers.flatMap((x) => answersOf(x).paysFor.filter((p) => p.via === kind).map((p) => p.serviceId)))]
    return {
      id, name: `${label}${bill.monthly == null ? ' (anslået pris)' : ''}`, providerName, providerId: bill.providerId ?? undefined, logoId: bill.providerId ?? undefined,
      category: kind, monthly, firstYear: monthly * 12, bindingMonths: bill.bindingLeft ?? 0,
      includes: included.map((sid) => ({ serviceId: sid, capacity: this.service.get(sid)?.capacityType === 'seats' ? homeMembers.length : 2 })),
      attributes: {}, verified: true, keep: { memberId, kind },
    }
  }

  /**
   * What a current subscription covers: the plan's contents if we know the plan,
   * else the plan of that service whose price is closest to what they pay
   * (so 449 kr. for Viaplay counts as the sport package, not Film & Serier).
   */
  currentPlanIncludes(svc: Service, productId: string | null | undefined, monthly: number | null) {
    const base = [{ serviceId: svc.id, capacity: svc.capacityType === 'seats' ? 1 : 2 }]
    const known = productId ? this.product.get(productId) : undefined
    if (known?.includes.length) return known.includes
    if (monthly == null) return base
    const plans = this.ctx.products.filter((p) => p.active && p.category === 'streaming' && p.includes.some((i) => i.serviceId === svc.id) && !p.attributes.requires)
    const closest = plans.sort((a, b) => Math.abs(a.price - monthly) - Math.abs(b.price - monthly))[0]
    return closest && Math.abs(closest.price - monthly) <= Math.max(20, monthly * 0.15) ? closest.includes : base
  }

  planPrice(productId: string | null | undefined) {
    return productId ? this.product.get(productId)?.price ?? null : null
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
  /** For "choose N" items: which services they were used for. */
  chosen: Record<string, string[]>
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
    const chosen = new Map<string, string[]>()
    const items = pkg.productIds.map((id) => cat.priced(id)).filter((x): x is Priced => !!x)
    const users = pkg.memberIds.filter((id) => memberById.has(id))
    const homes = new Set(users.map((id) => memberById.get(id)!.householdId))
    homes.add(pkg.householdId)
    const crossHome = homes.size > 1
    const warnings: PackageWarning[] = []

    // Capacity per service across the package's items.
    const capacity = new Map<string, number>()
    for (const it of items) for (const inc of it.includes) capacity.set(inc.serviceId, (capacity.get(inc.serviceId) ?? 0) + inc.capacity)
    // "Choose N" packages fill in with what the package's users want, uncovered services first.
    for (const it of items) {
      const ch = it.attributes.choose
      if (!ch) continue
      if (it.selected) {
        chosen.set(it.id, it.selected)
        continue
      }
      const demandOf = (sid: string) => users.filter((u) => answersOf(memberById.get(u)!).wants.includes(sid)).length
      const picks = ch.from
        .filter((sid) => demandOf(sid) > 0)
        .sort((a, b) => Number(capacity.has(a)) - Number(capacity.has(b)) || demandOf(b) - demandOf(a))
        .slice(0, ch.count)
      for (const sid of picks) {
        const cap = ch.capacity ?? (cat.service.get(sid)?.capacityType === 'seats' ? 1 : 2)
        capacity.set(sid, (capacity.get(sid) ?? 0) + cap)
      }
      chosen.set(it.id, picks)
    }
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
      chosen: Object.fromEntries(chosen),
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
    for (const p of a.paysFor) {
      if ((p.via ?? 'self') !== 'self') continue // included in a bill, or paid by someone else
      total += p.monthly ?? cat.planPrice(p.productId) ?? cat.cheapestPrice(p.serviceId)
    }
    if (a.mobile) total += a.mobile.monthly ?? estimateBill(cat, 'mobile', a.mobile.providerId)
    if (a.broadband) homeBroadband.set(m.householdId, Math.max(homeBroadband.get(m.householdId) ?? 0, a.broadband.monthly ?? estimateBill(cat, 'broadband', a.broadband.providerId)))
    if (a.tv) homeTv.set(m.householdId, Math.max(homeTv.get(m.householdId) ?? 0, a.tv.monthly ?? estimateBill(cat, 'tv', a.tv.providerId)))
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
  for (const o of expandChoose(options, needed)) {
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

/** Turn "choose N of these" products into concrete options for the services this unit needs. */
function expandChoose(options: Option[], needed: string[]): Option[] {
  const out: Option[] = []
  for (const o of options) {
    const ch = o.product.attributes.choose
    if (!ch) {
      out.push(o)
      continue
    }
    const relevant = ch.from.filter((s) => needed.includes(s))
    if (!relevant.length) continue
    const combos = relevant.length <= ch.count ? [relevant] : combinations(relevant, ch.count).slice(0, 40)
    for (const combo of combos) {
      const capacity = new Map(o.capacity)
      for (const sid of combo) capacity.set(sid, ch.capacity ?? 2)
      out.push({ ...o, capacity })
    }
  }
  return out
}

function combinations<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]]
  if (arr.length < k) return []
  const [head, ...rest] = arr
  return [...combinations(rest, k - 1).map((c) => [head, ...c]), ...combinations(rest, k)]
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

export interface OptimiseOptions {
  /** Wanted services to leave out (to fit a budget). */
  exclude?: Set<string>
  /** Allow ad-supported plans. Default true. */
  adsOk?: boolean
  /** Allow plans with a binding period. Default true. */
  allowBinding?: boolean
  /** Switch mobile/internet when it pays off (still respects people who said no). Default true. */
  switchTelco?: boolean
}

/**
 * mode 'legal': only share where the terms allow.
 * mode 'bend': also share across homes for services enforced at or below `tolerance`.
 */
export function optimise(cat: Catalog, mode: 'legal' | 'bend', tolerance: Enforcement = 'high', opts: OptimiseOptions = {}): BoardPackage[] {
  const { members, households } = cat.ctx
  const { exclude, adsOk = true, allowBinding = true, switchTelco = true } = opts
  const concurrency = cat.ctx.concurrency ?? 0.5
  const tol = mode === 'legal' ? 0 : ENFORCEMENT_RANK[tolerance]
  const memberById = new Map(members.map((m) => [m.id, m]))
  const packages: BoardPackage[] = []
  const name = (hid: string) => households.find((h) => h.id === hid)?.name ?? 'Hjem'
  const okBinding = (p: Product) => allowBinding || p.bindingMonths === 0

  // --- Telco first: services included in a kept mobile/internet/TV bill don't need buying.
  const telco: BoardPackage[] = []
  const coveredByKeep = new Set<string>() // `${memberId}:${serviceId}`
  const mobileProducts = cat.ctx.products.filter((p) => p.active && p.category === 'mobile' && okBinding(p))
  const broadbandProducts = cat.ctx.products.filter((p) => p.active && p.category === 'broadband' && okBinding(p))
  const willSwitch = (a: Answers, saving: number, threshold: number) =>
    switchTelco && (a.willingToSwitch === 'yes' || (a.willingToSwitch === 'if-worth-it' && saving >= threshold))
  const coverVia = (m: Member, via: PaidVia) => {
    for (const p of answersOf(m).paysFor) if ((p.via ?? 'self') === via) coveredByKeep.add(`${m.id}:${p.serviceId}`)
  }
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
      const current = a.mobile.monthly ?? estimateBill(cat, 'mobile', a.mobile.providerId)
      if (best && best.price < current && willSwitch(a, current - best.price, 30)) ids.push(best.id)
      else {
        ids.push(`${KEEP_PREFIX}mobile:${m.id}`)
        coverVia(m, 'mobile')
      }
    }
    const bbOwner = home.find((m) => answersOf(m).broadband)
    if (bbOwner) {
      const a = answersOf(bbOwner)
      const best = broadbandProducts.filter((p) => (p.attributes.speedMbit ?? 0) >= 500).sort((x, y) => firstYear(x) - firstYear(y))[0]
      const current = a.broadband!.monthly ?? estimateBill(cat, 'broadband', a.broadband!.providerId)
      if (best && best.price < current && (a.broadband!.bindingLeft ?? 0) === 0 && willSwitch(a, current - best.price, 40)) ids.push(best.id)
      else {
        ids.push(`${KEEP_PREFIX}broadband:${bbOwner.id}`)
        for (const m of home) coverVia(m, 'broadband')
      }
    }
    const tvOwner = home.find((m) => answersOf(m).tv)
    if (tvOwner) {
      ids.push(`${KEEP_PREFIX}tv:${tvOwner.id}`)
      for (const m of home) coverVia(m, 'tv')
    }
    if (ids.length) telco.push({ id: pid(), name: `Mobil & internet · ${h.name}`, householdId: h.id, productIds: ids, memberIds: users.length ? users : home.map((m) => m.id) })
  }

  const streamOptions = (unitMembers: string[]): Option[] => {
    const answers = unitMembers.map((id) => answersOf(memberById.get(id)!))
    const allStudents = answers.length === 1 && answers[0].student
    return cat.ctx.products
      .filter((p) => p.active && (p.category === 'streaming' || p.category === 'bundle') && (p.includes.length || p.attributes.choose))
      .filter((p) => (adsOk || !p.attributes.ads) && okBinding(p))
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
      if (!svc || svc.category === 'free' || exclude?.has(sid)) continue
      if (coveredByKeep.has(`${m.id}:${sid}`)) continue
      const paid = a.paysFor.find((p) => p.serviceId === sid)
      // Someone outside the family pays, or the person won't switch: keep it as it is.
      if (paid && ((paid.via ?? 'self') === 'other' || (a.willingToSwitch === 'no' && (paid.via ?? 'self') === 'self'))) {
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
      packages.push({ id: pid(), name: label, householdId: payer, productIds: Array(ch.copies).fill(ch.option.id), memberIds: pkgUsers })
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
  const merged = mergeByHome(cat, packages, (hid, shared) => (shared ? `Delt med andre hjem · betales af ${name(hid)}` : `Streaming · ${name(hid)}`))
  for (const [mid, ids] of keepers) {
    merged.push({ id: pid(), name: `Beholder · ${memberById.get(mid)!.name}`, householdId: memberById.get(mid)!.householdId, productIds: ids, memberIds: [mid] })
  }
  return [...merged, ...telco]
}

/** A typical price for a bill the person didn't put a price on: the provider's cheapest plan, else a market average. */
export function estimateBill(cat: Catalog, kind: 'mobile' | 'broadband' | 'tv', providerId: string | null) {
  const fallback = { mobile: 149, broadband: 299, tv: 299 }[kind]
  if (!providerId) return fallback
  const prices = cat.ctx.products.filter((p) => p.active && p.providerId === providerId && p.category === kind).map((p) => p.price)
  return prices.length ? Math.min(...prices) : fallback
}

// ---------------------------------------------------------------------------
// Budget frontier: the best set of services for each price level
// ---------------------------------------------------------------------------

export interface FrontierPoint {
  monthly: number
  /** Wanted services this point covers. */
  services: string[]
  /** Wanted services left out. */
  dropped: string[]
  /** Sum of wish weights covered (must-have counts 3, nice-to-have 1, per person). */
  score: number
  board: BoardPackage[]
}

export interface FrontierInput {
  mode: 'legal' | 'bend'
  tolerance: Enforcement
  opts: OptimiseOptions
}

/** Each wanted service, how many want it, and whether anyone must have it. */
export function wishes(cat: Catalog) {
  const out = new Map<string, { weight: number; people: string[]; must: boolean }>()
  for (const m of cat.ctx.members) {
    const a = answersOf(m)
    for (const sid of a.wants) {
      const svc = cat.service.get(sid)
      if (!svc || svc.category === 'free') continue
      const must = (a.mustHave ?? []).includes(sid)
      const w = out.get(sid) ?? { weight: 0, people: [], must: false }
      w.weight += must ? 3 : 1
      w.people.push(m.id)
      w.must ||= must
      out.set(sid, w)
    }
  }
  return out
}

/**
 * Greedy frontier: start with every wish, then repeatedly drop the nice-to-have
 * that saves the most money per lost wish. Must-haves are never dropped.
 * Points are ordered from most to fewest services.
 */
export function frontier(cat: Catalog, { mode, tolerance, opts }: FrontierInput): FrontierPoint[] {
  const w = wishes(cat)
  const all = [...w.keys()]
  const evalFor = (exclude: Set<string>) => {
    const board = optimise(cat, mode, tolerance, { ...opts, exclude })
    return { board, monthly: evaluate(cat, board).monthly }
  }
  const point = (exclude: Set<string>, r: { board: BoardPackage[]; monthly: number }): FrontierPoint => {
    const services = all.filter((s) => !exclude.has(s))
    return { monthly: r.monthly, services, dropped: [...exclude], score: services.reduce((n, s) => n + w.get(s)!.weight, 0), board: r.board }
  }
  const exclude = new Set<string>()
  let cur = evalFor(exclude)
  const points = [point(exclude, cur)]
  for (;;) {
    let best: { sid: string; r: ReturnType<typeof evalFor>; ratio: number } | null = null
    for (const sid of all) {
      if (exclude.has(sid) || w.get(sid)!.must) continue
      const r = evalFor(new Set([...exclude, sid]))
      const saving = cur.monthly - r.monthly
      if (saving <= 0.5) continue
      const ratio = saving / w.get(sid)!.weight
      if (!best || ratio > best.ratio) best = { sid, r, ratio }
    }
    if (!best) break
    exclude.add(best.sid)
    cur = best.r
    points.push(point(exclude, cur))
  }
  return points
}

/** The point with the most wishes that fits the budget; else the cheapest point. */
export function pickForBudget(points: FrontierPoint[], budget: number) {
  return points.find((p) => p.monthly <= budget + 0.5) ?? points[points.length - 1]
}

/**
 * Frontier pick plus a fill-up pass: add left-out services back, most wanted first,
 * while the total still fits the budget. Catches cases the greedy path misses.
 */
export function bestForBudget(cat: Catalog, input: FrontierInput, budget: number, points = frontier(cat, input)): FrontierPoint {
  const pick = pickForBudget(points, budget)
  if (pick.monthly > budget + 0.5) return pick
  const w = wishes(cat)
  let exclude = new Set(pick.dropped)
  let best = pick
  for (const sid of [...pick.dropped].sort((a, b) => w.get(b)!.weight - w.get(a)!.weight)) {
    const trial = new Set([...exclude].filter((x) => x !== sid))
    const board = optimise(cat, input.mode, input.tolerance, { ...input.opts, exclude: trial })
    const monthly = evaluate(cat, board).monthly
    if (monthly <= budget + 0.5) {
      exclude = trial
      const services = [...w.keys()].filter((x) => !trial.has(x))
      best = { monthly, services, dropped: [...trial], score: services.reduce((n, x) => n + w.get(x)!.weight, 0), board }
    }
  }
  return best
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

function mergeByHome(cat: Catalog, packages: BoardPackage[], label: (hid: string, shared: boolean) => string): BoardPackage[] {
  const homeOf = new Map(cat.ctx.members.map((m) => [m.id, m.householdId]))
  const out: BoardPackage[] = []
  const groups = new Map<string, BoardPackage>()
  for (const p of packages) {
    if (!(p.name.startsWith('Streaming ·') || p.name.startsWith('Delt'))) {
      out.push(p)
      continue
    }
    // Keep a home's own subscriptions apart from those shared with other homes, so
    // people from another home never appear on services they don't share.
    const shared = p.memberIds.some((m) => homeOf.get(m) !== p.householdId)
    const key = `${p.householdId}:${shared}`
    const existing = groups.get(key)
    if (existing) {
      existing.productIds.push(...p.productIds)
      existing.memberIds = [...new Set([...existing.memberIds, ...p.memberIds])]
      continue
    }
    const copy = { ...p, name: label(p.householdId, shared), productIds: [...p.productIds], memberIds: [...p.memberIds] }
    groups.set(key, copy)
    out.push(copy)
  }
  return out
}

// ---------------------------------------------------------------------------
// Today's setup and concrete suggestions
// ---------------------------------------------------------------------------

/** The family's setup as it is today, built from everyone's answers. */
export function todayBoard(cat: Catalog): BoardPackage[] {
  const out: BoardPackage[] = []
  for (const h of cat.ctx.households) {
    const home = cat.ctx.members.filter((m) => m.householdId === h.id && m.answers)
    const ids: string[] = []
    for (const m of home) {
      const a = answersOf(m)
      for (const p of a.paysFor) if ((p.via ?? 'self') === 'self' || p.via === 'other') ids.push(`${KEEP_PREFIX}streaming:${m.id}:${p.serviceId}`)
      if (a.mobile) ids.push(`${KEEP_PREFIX}mobile:${m.id}`)
    }
    const bb = home.find((m) => answersOf(m).broadband)
    if (bb) ids.push(`${KEEP_PREFIX}broadband:${bb.id}`)
    const tv = home.find((m) => answersOf(m).tv)
    if (tv) ids.push(`${KEEP_PREFIX}tv:${tv.id}`)
    if (ids.length) out.push({ id: `today-${h.id}`, name: h.name, householdId: h.id, productIds: ids, memberIds: home.map((m) => m.id) })
  }
  return out
}

export interface Suggestion {
  id: string
  group: 'save' | 'more' | 'bend'
  title: string
  detail: string
  /** Monthly saving (negative = costs more). */
  saving: number
  /** Wishes covered after minus before. */
  gained: number
  risk: Enforcement
  board: BoardPackage[]
}

const clone = (b: BoardPackage[]) => b.map((p) => ({ ...p, productIds: [...p.productIds], memberIds: [...p.memberIds] }))
const signature = (b: BoardPackage[]) => b.map((p) => `${p.householdId}:${[...p.productIds].sort().join(',')}:${[...p.memberIds].sort().join(',')}`).sort().join('|')
const coverage = (r: BoardResult) => r.missing.length + r.missingTelco.length
const capacityWarnings = (r: BoardResult) => r.packages.reduce((n, p) => n + p.warnings.filter((w) => w.level === 'warn').length, 0)

/** Remove items that add nothing (their services are covered elsewhere), most expensive first. */
function prune(cat: Catalog, board: BoardPackage[], homeId: string | null, protect: Set<string>) {
  const removed: string[] = []
  let base = evaluate(cat, board)
  const candidates = board
    .flatMap((p, pi) => p.productIds.map((id, ii) => ({ pi, ii, id, item: cat.priced(id) })))
    .filter((c) => c.item && (homeId == null || board[c.pi].householdId === homeId) && !protect.has(c.id))
    .filter((c) => c.item!.category === 'streaming' || c.item!.category === 'bundle')
    .sort((a, b) => b.item!.monthly - a.item!.monthly)
  for (const c of candidates) {
    const pkg = board[c.pi]
    const at = pkg.productIds.indexOf(c.id)
    if (at === -1) continue
    pkg.productIds.splice(at, 1)
    const r = evaluate(cat, board)
    if (coverage(r) <= coverage(base) && capacityWarnings(r) <= capacityWarnings(base)) {
      removed.push(c.id)
      base = r
    } else pkg.productIds.splice(at, 0, c.id)
  }
  return removed
}

export interface SuggestOptions {
  adsOk?: boolean
  allowBinding?: boolean
}

/**
 * Concrete moves on the current setup, each priced by the engine:
 * replace an item (and drop what it makes redundant), drop unused items,
 * add a missing wish, and share across homes (grey zone, separate group).
 */
export function suggest(cat: Catalog, board: BoardPackage[], opts: SuggestOptions = {}): Suggestion[] {
  const { adsOk = true, allowBinding = true } = opts
  const memberById = new Map(cat.ctx.members.map((m) => [m.id, m]))
  const before = evaluate(cat, board)
  const out = new Map<string, Suggestion>()
  const nameOf = (id: string) => memberById.get(id)?.name ?? '?'
  const itemLabel = (it: Priced) => (it.keep ? `${it.keep.kind === 'streaming' ? it.providerName : it.name.replace(' (anslået pris)', '')}${it.keep.kind !== 'streaming' ? ` hos ${it.providerName}` : ''}` : `${it.name.toLowerCase().startsWith(it.providerName.toLowerCase()) ? it.name : `${it.providerName} ${it.name}`}`)
  const owner = (it: Priced) => (it.keep ? `${nameOf(it.keep.memberId)}s ` : '')
  const allowed = (p: Product) => p.active && (adsOk || !p.attributes.ads) && (allowBinding || p.bindingMonths === 0)

  const add = (s: Omit<Suggestion, 'id' | 'risk' | 'saving' | 'gained'> & { slot?: string }, after: BoardResult) => {
    const saving = before.monthly - after.monthly
    const gained = coverage(before) - coverage(after)
    const risk = after.maxRisk
    if (s.group !== 'bend' && ENFORCEMENT_RANK[risk] > ENFORCEMENT_RANK[before.maxRisk]) return
    if (gained < 0) return
    if (s.group === 'save' && saving < 5) return
    // One suggestion per replaced item (the best), and never two with the same title.
    const key = s.slot ?? s.title
    const prev = out.get(key)
    const { slot: _slot, ...rest } = s
    if (!prev || saving > prev.saving) out.set(key, { ...rest, id: signature(s.board), saving, gained, risk })
  }

  // 1) Replace an item with something else, then drop what became redundant.
  for (const [pi, pkg] of board.entries()) {
    for (const [ii, id] of pkg.productIds.entries()) {
      const it = cat.priced(id)
      if (!it) continue
      const who = it.keep ? memberById.get(it.keep.memberId) : undefined
      const a = who ? answersOf(who) : undefined
      if (a?.willingToSwitch === 'no') continue
      if (it.keep?.kind === 'broadband' && (a?.broadband?.bindingLeft ?? 0) > 0) continue
      if (it.keep?.kind === 'tv') continue
      const sids = it.includes.map((i) => i.serviceId)
      // What could become redundant in this home if the new product covers more.
      const homeStreaming = board.filter((p) => p.householdId === pkg.householdId).flatMap((p) => p.productIds).map((x) => cat.priced(x)).filter((x): x is Priced => !!x && (x.category === 'streaming' || x.category === 'bundle'))
      const budgetCap = it.monthly + homeStreaming.reduce((n, x) => n + x.monthly, 0)
      const minData = a ? (a.dataNeed === 'low' ? 0 : a.dataNeed === 'mid' ? 30 : 100) : 0
      const candidates = cat.ctx.products.filter((p) => {
        if (!allowed(p) || p.id === id || p.price >= budgetCap) return false
        if (p.attributes.requires === 'student' && !pkg.memberIds.every((m) => answersOf(memberById.get(m)!).student)) return false
        if (it.category === 'mobile') return p.category === 'mobile' && (p.attributes.lines ?? 1) === 1 && ((p.attributes.dataGb ?? 0) === -1 || (p.attributes.dataGb ?? 0) >= minData)
        if (it.category === 'broadband') return p.category === 'broadband' && (p.attributes.speedMbit ?? 0) >= 500
        if (it.category === 'streaming' || it.category === 'bundle') {
          if (p.category !== 'streaming' && p.category !== 'bundle') return false
          const covers = new Set([...p.includes.map((x) => x.serviceId), ...(p.attributes.choose?.from ?? [])])
          return sids.every((s) => covers.has(s))
        }
        return false
      })
      for (const p of candidates) {
        const next = clone(board)
        next[pi].productIds[ii] = p.id
        const removed = prune(cat, next, pkg.householdId, new Set([p.id]))
        const after = evaluate(cat, next)
        const np = cat.priced(p.id)!
        const dropped = removed.map((x) => cat.priced(x)).filter((x): x is Priced => !!x).map(itemLabel)
        const extra = np.attributes.choose ? after.packages[pi]?.chosen[p.id] : undefined
        add(
          {
            group: 'save',
            slot: `replace:${pi}:${ii}:${dropped.length}`,
            title: `Skift ${owner(it)}${itemLabel(it)} til ${itemLabel(np)}${dropped.length ? ` og drop ${dropped.join(' og ')}` : ''}`,
            detail: [
              extra?.length ? `Inkluderer ${extra.map((s) => cat.service.get(s)?.name).join(', ')}.` : '',
              np.bindingMonths ? `${np.bindingMonths} mdr. binding.` : '',
              !np.verified ? 'Prisen er ikke bekræftet.' : '',
            ].filter(Boolean).join(' '),
            board: next,
          },
          after,
        )
      }
    }
  }

  // 2) Drop items nobody uses.
  {
    const next = clone(board)
    const removed = prune(cat, next, null, new Set())
    if (removed.length) {
      add({ group: 'save', title: `Drop ${removed.map((x) => itemLabel(cat.priced(x)!)).join(' og ')}`, detail: 'Ingen har ønsket den, eller den er allerede dækket af noget andet.', board: next }, evaluate(cat, next))
    }
  }

  // 3) Add a missing wish the cheapest way.
  for (const miss of before.missing) {
    const m = memberById.get(miss.memberId)!
    const pi = board.findIndex((p) => p.householdId === m.householdId && p.memberIds.includes(m.id))
    const options = cat.ctx.products
      .filter((p) => allowed(p) && (p.category === 'streaming' || p.category === 'bundle') && (p.includes.some((i) => i.serviceId === miss.serviceId) || p.attributes.choose?.from.includes(miss.serviceId)))
      .filter((p) => !p.attributes.requires || answersOf(m).student)
      .sort((a, b) => a.price - b.price)
      .slice(0, 3)
    for (const p of options) {
      const next = clone(board)
      if (pi >= 0) next[pi].productIds.push(p.id)
      else next.push({ id: `p-${m.id}-${p.id}`, name: cat.ctx.households.find((h) => h.id === m.householdId)?.name ?? 'Hjem', householdId: m.householdId, productIds: [p.id], memberIds: [m.id] })
      const target = pi >= 0 ? next[pi] : next[next.length - 1]
      if (!target.memberIds.includes(m.id)) target.memberIds.push(m.id)
      prune(cat, next, m.householdId, new Set([p.id]))
      const svc = cat.service.get(miss.serviceId)?.name
      add({ group: 'more', slot: `add:${m.id}:${miss.serviceId}`, title: `Få ${svc} til ${m.name}`, detail: `Med ${itemLabel(cat.priced(p.id)!)}.`, board: next }, evaluate(cat, next))
    }
  }

  // 4) Use a service another home already pays for: official extra member, or sharing (grey zone).
  for (const [ai, host] of board.entries()) {
    for (const hostId of new Set(host.productIds)) {
      const hp = cat.priced(hostId)
      if (!hp || hp.category !== 'streaming') continue
      const sid = hp.includes[0]?.serviceId
      const svc = sid ? cat.service.get(sid) : undefined
      if (!svc) continue
      for (const [bi, guest] of board.entries()) {
        if (bi === ai || guest.householdId === host.householdId) continue
        const guests = guest.memberIds.filter((u) => answersOf(memberById.get(u)!).wants.includes(sid))
        if (!guests.length) continue
        const next = clone(board)
        next[ai].memberIds.push(...guests.filter((g) => !next[ai].memberIds.includes(g)))
        const product = cat.product.get(hostId)
        const legal = !!product?.attributes.extraMember && guests.length <= product.attributes.extraMember.slots
        if (legal) for (let i = 0; i < guests.length; i++) next[ai].productIds.push(`${hostId}${EXTRA_SUFFIX}`)
        prune(cat, next, guest.householdId, new Set())
        const homeA = cat.ctx.households.find((h) => h.id === host.householdId)?.name
        const homeB = cat.ctx.households.find((h) => h.id === guest.householdId)?.name
        add(
          {
            group: legal || !svc.sharing.householdOnly ? 'save' : 'bend',
            title: legal ? `Gør ${guests.map(nameOf).join(' og ')} til ekstra medlem på ${homeA}s ${svc.name}` : `Del ${svc.name} mellem ${homeA} og ${homeB}`,
            detail: legal ? 'Officielt ekstra medlem: eget login, helt efter reglerne.' : svc.sharing.howEnforced,
            board: next,
          },
          evaluate(cat, next),
        )
      }
    }
  }

  // Titles must be unique across slots too.
  const byTitle = new Map<string, Suggestion>()
  for (const x of out.values()) if (!byTitle.has(x.title) || x.saving > byTitle.get(x.title)!.saving) byTitle.set(x.title, x)
  return [...byTitle.values()].sort((a, b) => b.saving - a.saving)
}

/** Apply a remove/add move to a home's packages, prune what became redundant, and price it. */
export function applyMove(cat: Catalog, board: BoardPackage[], move: { householdId: string; removeIds: string[]; addIds: string[]; memberIds?: string[] }) {
  const next = clone(board)
  const home = next.filter((p) => p.householdId === move.householdId)
  for (const id of move.removeIds) {
    const pkg = [...home, ...next].find((p) => p.productIds.includes(id))
    if (pkg) pkg.productIds.splice(pkg.productIds.indexOf(id), 1)
  }
  const valid = move.addIds.filter((id) => cat.priced(id))
  let target = home[0]
  if (!target && valid.length) {
    target = { id: `p-${move.householdId}-${valid[0]}`, name: cat.ctx.households.find((h) => h.id === move.householdId)?.name ?? 'Hjem', householdId: move.householdId, productIds: [], memberIds: [] }
    next.push(target)
  }
  if (target) {
    target.productIds.push(...valid)
    for (const m of move.memberIds ?? []) if (!target.memberIds.includes(m) && cat.ctx.members.some((x) => x.id === m)) target.memberIds.push(m)
  }
  const pruned = prune(cat, next, move.householdId, new Set(valid))
  return { board: next.filter((p) => p.productIds.length || p.memberIds.length), pruned }
}

export const suggestionMeta = { coverage, signature }
