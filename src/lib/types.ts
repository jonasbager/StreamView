export type Category = 'video' | 'music' | 'sport' | 'free'

/** How hard a service clamps down on sharing outside one household. */
export type Enforcement = 'none' | 'low' | 'medium' | 'high' | 'strict'

export const ENFORCEMENT_RANK: Record<Enforcement, number> = {
  none: 0,
  low: 1,
  medium: 2,
  high: 3,
  strict: 4,
}

export const ENFORCEMENT_LABEL: Record<Enforcement, string> = {
  none: 'Sharing allowed',
  low: 'Barely enforced',
  medium: 'Sometimes enforced',
  high: 'Actively enforced',
  strict: 'Strictly enforced',
}

/**
 * streams: one login shared through profiles, limited by simultaneous streams.
 * seats:   every person gets their own login (Spotify Family, Apple Family Sharing...).
 */
export type CapacityType = 'streams' | 'seats'

export interface SharingPolicy {
  /** The terms of service limit the subscription to one household / address. */
  householdOnly: boolean
  enforcement: Enforcement
  /** What the service actually does to stop sharing. */
  howEnforced: string
  /** The official way to share with family (if any). */
  officialSharing: string
}

export interface ExtraMember {
  price: number
  slots: number
}

export interface Plan {
  id: string
  serviceId: string
  name: string
  price: number
  /** Price per year if billed annually. */
  annualPrice?: number
  capacity: number
  ads: boolean
  extraMember?: ExtraMember
  note?: string
}

export interface Service {
  id: string
  name: string
  category: Category
  color: string
  capacityType: CapacityType
  sharing: SharingPolicy
  plans: Plan[]
  url: string
}

export interface BundleItem {
  serviceId: string
  /** Streams or seats this bundle gives for the service. */
  capacity: number
}

export interface Bundle {
  id: string
  name: string
  provider: string
  price: number
  annualPrice?: number
  ads: boolean
  includes: BundleItem[]
  note?: string
  custom?: boolean
}

export interface Household {
  id: string
  name: string
}

export interface Member {
  id: string
  name: string
  householdId: string
  wants: string[]
}

export interface Settings {
  /** Share of people who watch the same service at the same time (0..1). */
  concurrency: number
  allowAds: boolean
  annualBilling: boolean
  /** Highest enforcement level you are willing to bend in the "bend the rules" plan. */
  riskTolerance: Exclude<Enforcement, 'none'>
}

export interface AppState {
  households: Household[]
  members: Member[]
  settings: Settings
  priceOverrides: Record<string, number>
  customDeals: Bundle[]
  hiddenBundles: string[]
}
