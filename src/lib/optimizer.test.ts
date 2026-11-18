import { describe, expect, it } from 'vitest'
import { PRESET_BUNDLES, SERVICES } from '../data/catalog'
import { buildCatalog, computeScenario } from './optimizer'
import { DEMO_STATE } from './store'
import type { AppState } from './types'

const run = (state: AppState, mode: 'individual' | 'legal' | 'bend') =>
  computeScenario({ state, catalog: buildCatalog(state, SERVICES, PRESET_BUNDLES), mode })

const family = (patch: Partial<AppState>): AppState => ({ ...DEMO_STATE, ...patch })

describe('optimizer', () => {
  it('orders scenarios: individual >= legal >= bend', () => {
    const i = run(DEMO_STATE, 'individual').total
    const l = run(DEMO_STATE, 'legal').total
    const b = run(DEMO_STATE, 'bend').total
    expect(i).toBeGreaterThanOrEqual(l)
    expect(l).toBeGreaterThanOrEqual(b)
  })

  it('uses Spotify Family for 3 people in one home', () => {
    const s = family({
      households: [{ id: 'a', name: 'A' }],
      members: ['x', 'y', 'z'].map((id) => ({ id, name: id, householdId: 'a', wants: ['spotify'] })),
    })
    const r = run(s, 'legal')
    expect(r.purchases.map((p) => p.optionId)).toEqual(['spotify-family'])
    expect(r.total).toBe(189)
  })

  it('never shares a household-only service across homes in the legal plan', () => {
    const r = run(DEMO_STATE, 'legal')
    expect(r.purchases.every((p) => !p.breaksRules)).toBe(true)
  })

  it('shares Apple Music across homes legally (Family Sharing)', () => {
    const s = family({
      households: [
        { id: 'a', name: 'A' },
        { id: 'b', name: 'B' },
      ],
      members: [
        { id: 'x', name: 'x', householdId: 'a', wants: ['applemusic'] },
        { id: 'y', name: 'y', householdId: 'b', wants: ['applemusic'] },
      ],
    })
    const r = run(s, 'legal')
    expect(r.purchases).toHaveLength(1)
    expect(r.purchases[0].optionId).toBe('applemusic-family')
    expect(r.purchases[0].breaksRules).toBe(false)
  })

  it('uses a Netflix extra member for one person in another home', () => {
    const s = family({
      settings: { ...DEMO_STATE.settings, allowAds: false },
      households: [
        { id: 'a', name: 'A' },
        { id: 'b', name: 'B' },
      ],
      members: [
        { id: 'x', name: 'x', householdId: 'a', wants: ['netflix'] },
        { id: 'y', name: 'y', householdId: 'a', wants: ['netflix'] },
        { id: 'z', name: 'z', householdId: 'b', wants: ['netflix'] },
      ],
    })
    const r = run(s, 'legal')
    expect(r.purchases.map((p) => p.kind).sort()).toEqual(['extra-member', 'plan'])
    expect(r.total).toBe(129 + 49)
  })

  it('flags cross-home sharing with the right risk level when bending', () => {
    const s = family({
      settings: { ...DEMO_STATE.settings, riskTolerance: 'strict' },
      households: [
        { id: 'a', name: 'A' },
        { id: 'b', name: 'B' },
      ],
      members: [
        { id: 'x', name: 'x', householdId: 'a', wants: ['netflix'] },
        { id: 'z', name: 'z', householdId: 'b', wants: ['netflix'] },
      ],
    })
    const r = run(s, 'bend')
    expect(r.purchases).toHaveLength(1)
    expect(r.purchases[0].breaksRules).toBe(true)
    expect(r.purchases[0].risk).toBe('strict')
  })

  it('respects risk tolerance: medium keeps Netflix per household', () => {
    const s = family({
      settings: { ...DEMO_STATE.settings, riskTolerance: 'medium' },
      households: [
        { id: 'a', name: 'A' },
        { id: 'b', name: 'B' },
      ],
      members: [
        { id: 'x', name: 'x', householdId: 'a', wants: ['netflix', 'tv2play'] },
        { id: 'z', name: 'z', householdId: 'b', wants: ['netflix', 'tv2play'] },
      ],
    })
    const r = run(s, 'bend')
    const netflix = r.purchases.filter((p) => p.optionId.startsWith('netflix'))
    expect(netflix.every((p) => !p.breaksRules)).toBe(true)
    const tv2 = r.purchases.filter((p) => p.optionId.startsWith('tv2play'))
    expect(tv2).toHaveLength(1)
    expect(tv2[0].risk).toBe('low')
  })

  it('picks Apple One Family when it beats Apple TV + Apple Music separately', () => {
    const s = family({
      households: [{ id: 'a', name: 'A' }],
      members: [
        { id: 'x', name: 'x', householdId: 'a', wants: ['applemusic', 'appletv'] },
        { id: 'y', name: 'y', householdId: 'a', wants: ['applemusic', 'appletv'] },
      ],
    })
    const r = run(s, 'legal')
    expect(r.purchases.map((p) => p.optionId)).toEqual(['appleone-family'])
  })

  it('costs per person add up to the total', () => {
    const r = run(DEMO_STATE, 'bend')
    const sum = Object.values(r.perMember).reduce((a, b) => a + b, 0)
    expect(sum).toBeCloseTo(r.total, 5)
  })
})

describe('personal accounts', () => {
  it('does not flag separate individual accounts as sharing', () => {
    const s = family({
      settings: { ...DEMO_STATE.settings, riskTolerance: 'strict' },
      households: [
        { id: 'a', name: 'A' },
        { id: 'b', name: 'B' },
      ],
      members: [
        { id: 'x', name: 'x', householdId: 'a', wants: ['youtube'] },
        { id: 'z', name: 'z', householdId: 'b', wants: ['youtube'] },
      ],
    })
    const r = run(s, 'bend')
    expect(r.total).toBe(198)
    expect(r.purchases.every((p) => !p.breaksRules)).toBe(true)
    expect(new Set(r.purchases.map((p) => p.payerHouseholdId))).toEqual(new Set(['a', 'b']))
  })
})
