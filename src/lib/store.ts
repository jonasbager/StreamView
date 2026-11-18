import { useEffect, useState } from 'react'
import type { AppState } from './types'

const KEY = 'streamview:v1'

export const uid = () => Math.random().toString(36).slice(2, 9)

export const DEMO_STATE: AppState = {
  households: [
    { id: 'h-home', name: 'Our home' },
    { id: 'h-grand', name: 'Grandparents' },
    { id: 'h-student', name: 'Student flat' },
  ],
  members: [
    { id: 'm-1', name: 'Anna', householdId: 'h-home', wants: ['netflix', 'hbomax', 'tv2play', 'spotify', 'drtv'] },
    { id: 'm-2', name: 'Peter', householdId: 'h-home', wants: ['netflix', 'viaplay', 'tv2play', 'spotify'] },
    { id: 'm-3', name: 'Emma', householdId: 'h-home', wants: ['disney', 'netflix', 'spotify', 'youtube'] },
    { id: 'm-4', name: 'Grandma', householdId: 'h-grand', wants: ['tv2play', 'drtv', 'netflix'] },
    { id: 'm-5', name: 'Grandpa', householdId: 'h-grand', wants: ['tv2play', 'viaplay'] },
    { id: 'm-6', name: 'Oliver', householdId: 'h-student', wants: ['netflix', 'hbomax', 'disney', 'spotify', 'youtube'] },
  ],
  settings: { concurrency: 0.5, allowAds: true, annualBilling: false, riskTolerance: 'high' },
  priceOverrides: {},
  customDeals: [],
  hiddenBundles: [],
}

export const EMPTY_STATE: AppState = {
  ...DEMO_STATE,
  households: [{ id: 'h-home', name: 'Our home' }],
  members: [],
}

function readHash(): AppState | null {
  const m = location.hash.match(/^#s=(.+)$/)
  if (!m) return null
  try {
    const json = decodeURIComponent(escape(atob(m[1])))
    return { ...DEMO_STATE, ...JSON.parse(json) }
  } catch {
    return null
  }
}

function readStored(): AppState | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? { ...DEMO_STATE, ...JSON.parse(raw) } : null
  } catch {
    return null
  }
}

export function shareUrl(state: AppState) {
  const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(state))))
  return `${location.origin}${location.pathname}#s=${b64}`
}

export function usePersistentState() {
  const [state, setState] = useState<AppState>(() => {
    const fromHash = readHash()
    if (fromHash) {
      history.replaceState(null, '', location.pathname)
      return fromHash
    }
    return readStored() ?? DEMO_STATE
  })
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state))
    } catch {
      /* storage unavailable: state just won't persist */
    }
  }, [state])
  return [state, setState] as const
}

export const kr = (n: number) => `${Math.round(n).toLocaleString('da-DK')} kr`
