import type { AppState, Bundle, Enforcement, Member, Plan, Service } from './types'
import { ENFORCEMENT_RANK } from './types'

export interface Catalog {
  services: Service[]
  bundles: Bundle[]
  serviceById: Map<string, Service>
}

export type PurchaseKind = 'plan' | 'bundle' | 'extra-member'

export interface Purchase {
  key: string
  kind: PurchaseKind
  optionId: string
  name: string
  /** Services this purchase is actually used for. */
  services: string[]
  copies: number
  monthly: number
  /** The household that holds the subscription. */
  payerHouseholdId: string
  users: string[]
  /** Users span more than one household on a service that is household-only. */
  breaksRules: boolean
  /** Highest enforcement level among rule-bending services in this purchase. */
  risk: Enforcement
  riskyServices: string[]
  note?: string
}

export interface Scenario {
  purchases: Purchase[]
  total: number
  perMember: Record<string, number>
  perHousehold: Record<string, number>
  uncovered: { memberId: string; serviceId: string }[]
}

interface Option {
  id: string
  kind: 'plan' | 'bundle'
  name: string
  /** Effective monthly price for one copy. */
  price: number
  /** serviceId -> capacity (streams or seats). */
  capacity: Map<string, number>
  plan?: Plan
  bundle?: Bundle
  note?: string
}

export function buildCatalog(state: AppState, services: Service[], presetBundles: Bundle[]): Catalog {
  const priced = services.map((s) => ({
    ...s,
    plans: s.plans.map((p) => ({ ...p, price: state.priceOverrides[p.id] ?? p.price })),
  }))
  const bundles = [...presetBundles.filter((b) => !state.hiddenBundles.includes(b.id)), ...state.customDeals].map(
    (b) => ({ ...b, price: state.priceOverrides[b.id] ?? b.price }),
  )
  return { services: priced, bundles, serviceById: new Map(priced.map((s) => [s.id, s])) }
}

function monthlyPrice(price: number, annual: number | undefined, useAnnual: boolean) {
  return useAnnual && annual !== undefined ? Math.min(price, annual / 12) : price
}

function allOptions(catalog: Catalog, state: AppState): Option[] {
  const { allowAds, annualBilling } = state.settings
  const opts: Option[] = []
  for (const s of catalog.services) {
    for (const p of s.plans) {
      if (p.ads && !allowAds) continue
      opts.push({
        id: p.id,
        kind: 'plan',
        name: `${s.name} ${p.name}`,
        price: monthlyPrice(p.price, p.annualPrice, annualBilling),
        capacity: new Map([[s.id, p.capacity]]),
        plan: p,
        note: annualBilling && p.annualPrice !== undefined && p.annualPrice / 12 < p.price ? 'billed yearly' : p.note,
      })
    }
  }
  for (const b of catalog.bundles) {
    if (b.ads && !allowAds) continue
    opts.push({
      id: b.id,
      kind: 'bundle',
      name: b.name,
      price: monthlyPrice(b.price, b.annualPrice, annualBilling),
      capacity: new Map(b.includes.map((i) => [i.serviceId, i.capacity])),
      bundle: b,
      note: b.note,
    })
  }
  return opts
}

/** How many simultaneous streams / seats a group of users needs for a service. */
function demand(service: Service, users: number, concurrency: number) {
  if (users === 0) return 0
  if (service.capacityType === 'seats') return users
  return Math.max(1, Math.ceil(users * concurrency - 1e-9))
}

/** Can a service be shared across households in this scenario? */
function canPool(service: Service, tolerance: number) {
  return !service.sharing.householdOnly || ENFORCEMENT_RANK[service.sharing.enforcement] <= tolerance
}

interface Unit {
  /** Household id, or 'pool' for the cross-household group. */
  id: string
  /** serviceId -> member ids that need it from this unit. */
  needs: Map<string, string[]>
}

interface Chosen {
  option: Option
  copies: number
  cost: number
  services: string[]
}

/**
 * Minimum-cost set cover over the unit's needed services. Bitmask DP is
 * fine here: a unit rarely needs more than ~15 services.
 */
function solveUnit(unit: Unit, options: Option[], catalog: Catalog, concurrency: number, allowedOption: (o: Option) => boolean): Chosen[] {
  const needed = [...unit.needs.keys()]
  const n = needed.length
  if (n === 0) return []
  const idx = new Map(needed.map((s, i) => [s, i]))

  const candidates: { option: Option; mask: number; copies: number; cost: number }[] = []
  for (const o of options) {
    if (!allowedOption(o)) continue
    let mask = 0
    let copies = 0
    for (const [sid, cap] of o.capacity) {
      const i = idx.get(sid)
      if (i === undefined) continue
      mask |= 1 << i
      const svc = catalog.serviceById.get(sid)!
      const d = demand(svc, unit.needs.get(sid)!.length, concurrency)
      copies = Math.max(copies, Math.ceil(d / Math.max(1, cap)))
    }
    if (mask === 0) continue
    copies = Math.max(1, copies)
    candidates.push({ option: o, mask, copies, cost: o.price * copies })
  }

  const full = (1 << n) - 1
  const dp = new Array<number>(full + 1).fill(Infinity)
  const from = new Array<number>(full + 1).fill(-1)
  const via = new Array<number>(full + 1).fill(-1)
  dp[0] = 0
  for (let m = 0; m <= full; m++) {
    if (dp[m] === Infinity) continue
    for (let c = 0; c < candidates.length; c++) {
      const next = m | candidates[c].mask
      if (next === m) continue
      const cost = dp[m] + candidates[c].cost
      // Tie-break toward fewer purchases (and so fewer logins to manage).
      if (cost < dp[next] - 1e-9) {
        dp[next] = cost
        from[next] = m
        via[next] = c
      }
    }
  }

  // Some services may be uncoverable (e.g. only ad plans while ads are off).
  let best = full
  if (dp[full] === Infinity) {
    let bestBits = -1
    for (let m = 0; m <= full; m++) {
      if (dp[m] === Infinity) continue
      const bits = popcount(m)
      if (bits > bestBits || (bits === bestBits && dp[m] < dp[best])) {
        best = m
        bestBits = bits
      }
    }
  }

  const chosen: Chosen[] = []
  let m = best
  while (m > 0 && via[m] !== -1) {
    const c = candidates[via[m]]
    const prev = from[m]
    const newly = c.mask & ~prev
    chosen.push({
      option: c.option,
      copies: c.copies,
      cost: c.cost,
      services: needed.filter((_, i) => (newly >> i) & 1),
    })
    m = prev
  }
  return chosen
}

function popcount(x: number) {
  let c = 0
  while (x) {
    x &= x - 1
    c++
  }
  return c
}

export interface ScenarioInput {
  state: AppState
  catalog: Catalog
  /** individual: nobody shares. legal: by the rules. bend: share across homes up to settings.riskTolerance. */
  mode: 'individual' | 'legal' | 'bend'
}

export function computeScenario({ state, catalog, mode }: ScenarioInput): Scenario {
  const { members, households, settings } = state
  const memberById = new Map(members.map((m) => [m.id, m]))
  const options = allOptions(catalog, state)
  const purchases: Purchase[] = []
  const uncovered: Scenario['uncovered'] = []

  if (mode === 'individual') {
    // Baseline: every person buys their own cheapest standalone plan, no sharing at all.
    for (const m of members) {
      for (const sid of m.wants) {
        const svc = catalog.serviceById.get(sid)
        if (!svc) continue
        const unit: Unit = { id: m.householdId, needs: new Map([[sid, [m.id]]]) }
        const chosen = solveUnit(unit, options, catalog, 1, (o) => o.kind === 'plan')
        if (chosen.length === 0) uncovered.push({ memberId: m.id, serviceId: sid })
        for (const ch of chosen) purchases.push(toPurchase(ch, unit, catalog, memberById, `${m.id}-${sid}`))
      }
    }
    return summarise(purchases, members, households, uncovered)
  }

  const tolerance = mode === 'legal' ? 0 : ENFORCEMENT_RANK[settings.riskTolerance]

  // 1. Household units: services that must stay inside one home in this scenario.
  const units: Unit[] = households.map((h) => ({ id: h.id, needs: new Map() }))
  const unitById = new Map(units.map((u) => [u.id, u]))
  const poolNeeds = new Map<string, string[]>()
  for (const m of members) {
    for (const sid of m.wants) {
      const svc = catalog.serviceById.get(sid)
      if (!svc) continue
      if (canPool(svc, tolerance)) {
        poolNeeds.set(sid, [...(poolNeeds.get(sid) ?? []), m.id])
      } else {
        const u = unitById.get(m.householdId)
        if (!u) continue
        u.needs.set(sid, [...(u.needs.get(sid) ?? []), m.id])
      }
    }
  }

  const householdChosen = new Map<string, Chosen[]>()
  for (const u of units) {
    const chosen = solveUnit(u, options, catalog, settings.concurrency, () => true)
    householdChosen.set(u.id, chosen)
  }

  // 2. Extra-member pass: a home that only needs a service for a few people can
  //    ride on another home's plan via the official "extra member" add-on.
  applyExtraMembers(units, householdChosen, catalog)

  for (const u of units) {
    for (const ch of householdChosen.get(u.id)!) {
      if ((ch as ExtraChosen).extraFor) continue
      purchases.push(toPurchase(ch, u, catalog, memberById, `${u.id}-${ch.option.id}`))
    }
    for (const sid of u.needs.keys()) {
      if (!householdChosen.get(u.id)!.some((c) => c.services.includes(sid))) {
        for (const mid of u.needs.get(sid)!) uncovered.push({ memberId: mid, serviceId: sid })
      }
    }
  }
  for (const u of units) {
    for (const ch of householdChosen.get(u.id)! as ExtraChosen[]) {
      if (!ch.extraFor) continue
      purchases.push({
        key: `${u.id}-extra-${ch.option.id}`,
        kind: 'extra-member',
        optionId: ch.option.id,
        name: `${ch.option.name}: extra member × ${ch.copies}`,
        services: ch.services,
        copies: ch.copies,
        monthly: ch.cost,
        payerHouseholdId: u.id,
        users: u.needs.get(ch.services[0]) ?? [],
        breaksRules: false,
        risk: 'none',
        riskyServices: [],
        note: `Added to ${households.find((h) => h.id === ch.extraFor)?.name ?? 'another home'}'s plan`,
      })
    }
  }

  // 3. Pool: services shared across households (officially, or by bending the rules).
  //    People already covered at home through a bundle don't need it from the pool.
  for (const [sid, mids] of [...poolNeeds]) {
    const left = mids.filter((mid) => {
      const hh = memberById.get(mid)!.householdId
      return !householdChosen.get(hh)?.some((c) => c.option.capacity.has(sid))
    })
    if (left.length) poolNeeds.set(sid, left)
    else poolNeeds.delete(sid)
  }
  const pool: Unit = { id: 'pool', needs: poolNeeds }
  const poolChosen = solveUnit(pool, options, catalog, settings.concurrency, (o) =>
    [...o.capacity.keys()].every((sid) => canPool(catalog.serviceById.get(sid)!, tolerance)),
  )
  for (const ch of poolChosen) {
    if (isPersonalAccount(ch, catalog)) {
      // One-person accounts (e.g. Spotify Individual) aren't shared: each home just buys its own.
      const byHome = new Map<string, string[]>()
      for (const mid of ch.services.flatMap((sid) => poolNeeds.get(sid) ?? [])) {
        const h = memberById.get(mid)!.householdId
        byHome.set(h, [...new Set([...(byHome.get(h) ?? []), mid])])
      }
      for (const [h, mids] of byHome) {
        const unit: Unit = { id: h, needs: new Map(ch.services.map((sid) => [sid, mids])) }
        const copies = mids.length
        purchases.push(toPurchase({ ...ch, copies, cost: ch.option.price * copies }, unit, catalog, memberById, `pool-${ch.option.id}-${h}`))
      }
    } else {
      purchases.push(toPurchase(ch, pool, catalog, memberById, `pool-${ch.option.id}`))
    }
  }
  for (const sid of poolNeeds.keys()) {
    if (!poolChosen.some((c) => c.services.includes(sid))) {
      for (const mid of poolNeeds.get(sid)!) uncovered.push({ memberId: mid, serviceId: sid })
    }
  }

  return summarise(purchases, members, households, uncovered)
}

function isPersonalAccount(ch: Chosen, catalog: Catalog) {
  return [...ch.option.capacity].every(([sid, cap]) => catalog.serviceById.get(sid)!.capacityType === 'seats' && cap === 1)
}

interface ExtraChosen extends Chosen {
  extraFor?: string
}

function applyExtraMembers(units: Unit[], chosen: Map<string, Chosen[]>, catalog: Catalog) {
  const usedSlots = new Map<string, number>() // `${hh}:${optionId}` -> used
  for (const b of units) {
    const list = chosen.get(b.id)! as ExtraChosen[]
    for (let i = 0; i < list.length; i++) {
      const ch = list[i]
      if (ch.option.kind !== 'plan' || ch.extraFor) continue
      const sid = ch.services[0]
      const people = b.needs.get(sid)?.length ?? 0
      if (!people) continue
      const svc = catalog.serviceById.get(sid)!
      for (const a of units) {
        if (a.id === b.id) continue
        const host = chosen.get(a.id)!.find((c) => c.option.plan?.serviceId === sid && c.option.plan.extraMember) as ExtraChosen | undefined
        if (!host || host.extraFor) continue
        const em = host.option.plan!.extraMember!
        const key = `${a.id}:${host.option.id}`
        const free = em.slots * host.copies - (usedSlots.get(key) ?? 0)
        // An extra member is one person with their own login and one stream.
        if (people > free || people * em.price >= ch.cost - 1e-9) continue
        usedSlots.set(key, (usedSlots.get(key) ?? 0) + people)
        list[i] = {
          option: { ...host.option, name: svc.name, price: em.price },
          copies: people,
          cost: people * em.price,
          services: [sid],
          extraFor: a.id,
        }
        break
      }
    }
  }
}

function toPurchase(ch: Chosen, unit: Unit, catalog: Catalog, memberById: Map<string, Member>, key: string): Purchase {
  const users = [...new Set(ch.services.flatMap((s) => unit.needs.get(s) ?? []))]
  const homes = new Map<string, number>()
  for (const u of users) {
    const h = memberById.get(u)!.householdId
    homes.set(h, (homes.get(h) ?? 0) + 1)
  }
  const payer = [...homes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? unit.id
  const multiHome = homes.size > 1
  const riskyServices = multiHome
    ? ch.services.filter((sid) => catalog.serviceById.get(sid)!.sharing.householdOnly)
    : []
  const risk = riskyServices.reduce<Enforcement>((acc, sid) => {
    const e = catalog.serviceById.get(sid)!.sharing.enforcement
    return ENFORCEMENT_RANK[e] > ENFORCEMENT_RANK[acc] ? e : acc
  }, 'none')
  return {
    key,
    kind: ch.option.kind,
    optionId: ch.option.id,
    name: ch.option.name,
    services: ch.services,
    copies: ch.copies,
    monthly: ch.cost,
    payerHouseholdId: payer,
    users,
    breaksRules: riskyServices.length > 0,
    risk,
    riskyServices,
    note: ch.option.note,
  }
}

function summarise(purchases: Purchase[], members: Member[], households: { id: string }[], uncovered: Scenario['uncovered']): Scenario {
  const perMember: Record<string, number> = Object.fromEntries(members.map((m) => [m.id, 0]))
  const perHousehold: Record<string, number> = Object.fromEntries(households.map((h) => [h.id, 0]))
  let total = 0
  for (const p of purchases) {
    total += p.monthly
    perHousehold[p.payerHouseholdId] = (perHousehold[p.payerHouseholdId] ?? 0) + p.monthly
    if (p.users.length) for (const u of p.users) perMember[u] += p.monthly / p.users.length
  }
  purchases.sort((a, b) => b.monthly - a.monthly)
  return { purchases, total, perMember, perHousehold, uncovered }
}
