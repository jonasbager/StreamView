import { describe, expect, it } from 'vitest'
import type { Answers, Member, Product } from '@/db/schema'
import { PRODUCTS, PROVIDERS, SERVICES } from '@/db/seed-data'
import { Catalog, currentSpend, evaluate, optimise } from './engine'

const products: Product[] = PRODUCTS.map((p) => ({
  introPrice: null, introMonths: null, setupFee: 0, bindingMonths: 0, includes: [], attributes: {}, offerText: null,
  offerEndsAt: null, sourceUrl: null, verifiedAt: null, active: true, updatedAt: '', ...p,
}))
const services = SERVICES.map((s, i) => ({ ...s, sort: i }))

const base: Answers = {
  paysFor: [], wants: [], mobile: null, broadband: null, tv: null,
  willingToSwitch: 'yes', dataNeed: 'mid', adsOk: true, student: false,
}
const member = (id: string, householdId: string, a: Partial<Answers>): Member => ({
  id, familyId: 'f', householdId, userId: null, name: id, answers: { ...base, ...a }, onboardedAt: '', createdAt: '',
})
const households = [
  { id: 'home', familyId: 'f', name: 'Hjem' },
  { id: 'gran', familyId: 'f', name: 'Bedsteforældre' },
]
const make = (members: Member[]) => new Catalog({ services, providers: PROVIDERS.map((p) => ({ ...p, lastCheckedAt: null })), products, households, members })

describe('engine', () => {
  const members = [
    member('anna', 'home', { wants: ['netflix', 'spotify', 'tv2play'], paysFor: [{ serviceId: 'netflix', monthly: 129 }], mobile: { providerId: 'telia', monthly: 299 }, broadband: { providerId: 'yousee', monthly: 449 } }),
    member('peter', 'home', { wants: ['netflix', 'spotify'], mobile: { providerId: 'telia', monthly: 299 } }),
    member('mormor', 'gran', { wants: ['tv2play', 'netflix'], paysFor: [{ serviceId: 'tv2play', monthly: 99 }] }),
  ]

  it('sums current spend with broadband once per home', () => {
    expect(currentSpend(make(members))).toBe(129 + 299 + 449 + 299 + 99)
  })

  it('legal plan breaks no rules and covers every want', () => {
    const cat = make(members)
    const r = evaluate(cat, optimise(cat, 'legal'))
    expect(r.packages.every((p) => p.riskyServices.length === 0)).toBe(true)
    expect(r.missing).toEqual([])
    expect(r.missingTelco).toEqual([])
    expect(r.monthly).toBeLessThan(r.current)
  })

  it('bend plan is no more expensive and flags shared TV 2 Play', () => {
    const cat = make(members)
    const legal = evaluate(cat, optimise(cat, 'legal'))
    const bend = evaluate(cat, optimise(cat, 'bend', 'high'))
    expect(bend.monthly).toBeLessThanOrEqual(legal.monthly)
    expect(bend.packages.some((p) => p.riskyServices.includes('tv2play'))).toBe(true)
    expect(bend.missing).toEqual([])
  })

  it('keeps current subscriptions for people who will not switch', () => {
    const cat = make([member('x', 'home', { willingToSwitch: 'no', wants: ['netflix'], paysFor: [{ serviceId: 'netflix', monthly: 179 }], mobile: { providerId: 'telia', monthly: 299 } })])
    const board = optimise(cat, 'legal')
    expect(board.flatMap((p) => p.productIds).sort()).toEqual(['keep:mobile:x', 'keep:streaming:x:netflix'])
    expect(evaluate(cat, board).monthly).toBe(179 + 299)
  })

  it('uses a Netflix extra member legally when ads are not OK', () => {
    const cat = make([
      member('a', 'home', { wants: ['netflix'], adsOk: false }),
      member('b', 'home', { wants: ['netflix'], adsOk: false }),
      member('c', 'gran', { wants: ['netflix'], adsOk: false }),
    ])
    const r = evaluate(cat, optimise(cat, 'legal'))
    expect(r.monthly).toBe(129 + 49)
    expect(r.packages.every((p) => p.riskyServices.length === 0)).toBe(true)
  })

  it('does not flag a home member as sharing a service they have at home', () => {
    const cat = make([
      member('a', 'home', { wants: ['netflix', 'tv2play'] }),
      member('g', 'gran', { wants: ['netflix', 'tv2play'] }),
    ])
    const r = evaluate(cat, optimise(cat, 'bend', 'high'))
    expect(r.maxRisk).toBe('low')
    expect(r.packages.flatMap((p) => p.riskyServices)).toEqual(['tv2play'])
  })

  it('prices free trials at the normal monthly price', () => {
    const trial = { ...products.find((p) => p.id === 'appletv-std')!, introPrice: 0, introMonths: 1 }
    const cat = new Catalog({ services, providers: PROVIDERS.map((p) => ({ ...p, lastCheckedAt: null })), products: [trial], households, members: [] })
    expect(cat.priced('appletv-std')!.monthly).toBe(trial.price)
    expect(cat.priced('appletv-std')!.firstYear).toBe(trial.price * 11)
  })

  it('flags a manually shared Netflix as strict risk', () => {
    const cat = make(members)
    const r = evaluate(cat, [{ id: '1', name: 'x', householdId: 'home', productIds: ['netflix-standard'], memberIds: ['anna', 'mormor'] }])
    expect(r.packages[0].risk).toBe('strict')
  })
})
