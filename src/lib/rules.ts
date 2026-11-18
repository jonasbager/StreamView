export type Enforcement = 'none' | 'low' | 'medium' | 'high' | 'strict'
export const ENFORCEMENT_RANK: Record<Enforcement, number> = { none: 0, low: 1, medium: 2, high: 3, strict: 4 }
