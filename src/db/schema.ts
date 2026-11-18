import { boolean, integer, jsonb, pgTable, real, text, timestamp } from 'drizzle-orm/pg-core'

import type { Enforcement } from '@/lib/rules'
export type { Enforcement } from '@/lib/rules'
export { ENFORCEMENT_RANK } from '@/lib/rules'
export type ServiceCategory = 'video' | 'sport' | 'music' | 'free'
export type ProductCategory = 'streaming' | 'mobile' | 'broadband' | 'tv' | 'bundle'

export interface SharingRules {
  householdOnly: boolean
  enforcement: Enforcement
  howEnforced: string
  officialSharing: string
}

/** A streaming service a person can want (Netflix, Spotify ...). */
export const services = pgTable('services', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  category: text('category').$type<ServiceCategory>().notNull(),
  color: text('color').notNull(),
  /** streams: shared login limited by simultaneous streams. seats: each person has an own login. */
  capacityType: text('capacity_type').$type<'streams' | 'seats'>().notNull(),
  sharing: jsonb('sharing').$type<SharingRules>().notNull(),
  url: text('url').notNull(),
  sort: integer('sort').notNull().default(0),
})

/** A company selling something: streaming services themselves and telcos. */
export const providers = pgTable('providers', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  kind: text('kind').$type<'streaming' | 'telco'>().notNull(),
  color: text('color').notNull(),
  url: text('url').notNull(),
  /** Pages the weekly price job reads. */
  priceUrls: jsonb('price_urls').$type<string[]>().notNull().default([]),
  /** What this provider offers, for the onboarding questions. */
  offers: jsonb('offers').$type<Array<'mobile' | 'broadband' | 'tv'>>().notNull().default([]),
})

export interface ProductInclude {
  serviceId: string
  /** Streams or seats this product gives for the service. */
  capacity: number
}

export interface ProductAttributes {
  ads?: boolean
  /** Mobile data per month in GB (-1 = unlimited). */
  dataGb?: number
  /** Broadband download speed. */
  speedMbit?: number
  /** Number of mobile subscriptions included (family mobile plans). */
  lines?: number
  /** Annual price if billed yearly. */
  annualPrice?: number
  /** Extra member slots (Netflix) and price per slot. */
  extraMember?: { price: number; slots: number }
  /** A plan that requires a student, a young person or an existing customer. */
  requires?: 'student' | 'youth' | 'customer'
}

/** Anything you can pay for: a streaming plan, a mobile plan, broadband, a TV package or a bundle. */
export const products = pgTable('products', {
  id: text('id').primaryKey(),
  providerId: text('provider_id')
    .notNull()
    .references(() => providers.id),
  name: text('name').notNull(),
  category: text('category').$type<ProductCategory>().notNull(),
  price: real('price').notNull(),
  /** Intro offer: price for the first `introMonths` months. */
  introPrice: real('intro_price'),
  introMonths: integer('intro_months'),
  setupFee: real('setup_fee').notNull().default(0),
  bindingMonths: integer('binding_months').notNull().default(0),
  includes: jsonb('includes').$type<ProductInclude[]>().notNull().default([]),
  attributes: jsonb('attributes').$type<ProductAttributes>().notNull().default({}),
  offerText: text('offer_text'),
  offerEndsAt: timestamp('offer_ends_at', { mode: 'string' }),
  sourceUrl: text('source_url'),
  /** Set when a price was confirmed by the weekly job (approved) or by an admin. */
  verifiedAt: timestamp('verified_at', { mode: 'string' }),
  active: boolean('active').notNull().default(true),
  updatedAt: timestamp('updated_at', { mode: 'string' }).notNull().defaultNow(),
})

export const families = pgTable('families', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  ownerUserId: text('owner_user_id').notNull(),
  inviteCode: text('invite_code').notNull().unique(),
  board: jsonb('board').$type<Board>(),
  recommendation: jsonb('recommendation').$type<Recommendation>(),
  createdAt: timestamp('created_at', { mode: 'string' }).notNull().defaultNow(),
})

export const households = pgTable('households', {
  id: text('id').primaryKey(),
  familyId: text('family_id')
    .notNull()
    .references(() => families.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
})

export type Willingness = 'yes' | 'if-worth-it' | 'no'

export interface CurrentBill {
  providerId: string | null
  /** Free text when the provider isn't in the list. */
  other?: string
  monthly: number | null
  /** Months left of binding, if known. */
  bindingLeft?: number | null
}

export interface Answers {
  /** Streaming services this person pays for today, with what they pay. */
  paysFor: { serviceId: string; monthly: number | null }[]
  /** Services they want access to. */
  wants: string[]
  mobile: CurrentBill | null
  broadband: CurrentBill | null
  tv: CurrentBill | null
  willingToSwitch: Willingness
  /** Mobile data use: low (<10 GB), mid (10–50 GB), high (50+ GB / unlimited). */
  dataNeed: 'low' | 'mid' | 'high'
  adsOk: boolean
  student: boolean
}

export const members = pgTable('members', {
  id: text('id').primaryKey(),
  familyId: text('family_id')
    .notNull()
    .references(() => families.id, { onDelete: 'cascade' }),
  householdId: text('household_id')
    .notNull()
    .references(() => households.id),
  userId: text('user_id'),
  name: text('name').notNull(),
  answers: jsonb('answers').$type<Answers>(),
  onboardedAt: timestamp('onboarded_at', { mode: 'string' }),
  createdAt: timestamp('created_at', { mode: 'string' }).notNull().defaultNow(),
})

/** One "package" on the drag-and-drop board: products + the people using them. */
export interface BoardPackage {
  id: string
  name: string
  /** The home paying for it. */
  householdId: string
  productIds: string[]
  memberIds: string[]
}

export interface Board {
  packages: BoardPackage[]
  updatedAt: string
}

export interface RecommendedSetup {
  id: string
  title: string
  kind: 'legal' | 'bend'
  summary: string
  reasoning: string[]
  packages: Omit<BoardPackage, 'id'>[]
}

export interface Recommendation {
  createdAt: string
  intro: string
  setups: RecommendedSetup[]
}

/** One weekly run of the price job. */
export const priceRuns = pgTable('price_runs', {
  id: text('id').primaryKey(),
  startedAt: timestamp('started_at', { mode: 'string' }).notNull().defaultNow(),
  finishedAt: timestamp('finished_at', { mode: 'string' }),
  trigger: text('trigger').$type<'cron' | 'manual'>().notNull(),
  log: jsonb('log').$type<{ providerId: string; ok: boolean; message: string }[]>().notNull().default([]),
})

export interface ProposedProduct {
  name: string
  category: ProductCategory
  price: number
  introPrice: number | null
  introMonths: number | null
  setupFee: number
  bindingMonths: number
  includes: ProductInclude[]
  attributes: ProductAttributes
  offerText: string | null
  offerEndsAt: string | null
}

/** A change the price job found, waiting for an admin to approve it. */
export const priceChanges = pgTable('price_changes', {
  id: text('id').primaryKey(),
  runId: text('run_id').references(() => priceRuns.id, { onDelete: 'cascade' }),
  providerId: text('provider_id')
    .notNull()
    .references(() => providers.id),
  kind: text('kind').$type<'new' | 'update' | 'gone'>().notNull(),
  productId: text('product_id'),
  proposed: jsonb('proposed').$type<ProposedProduct>(),
  /** Human-readable list of what changed. */
  diff: jsonb('diff').$type<string[]>().notNull().default([]),
  sourceUrl: text('source_url'),
  status: text('status').$type<'pending' | 'approved' | 'rejected'>().notNull().default('pending'),
  createdAt: timestamp('created_at', { mode: 'string' }).notNull().defaultNow(),
})

export type Service = typeof services.$inferSelect
export type Provider = typeof providers.$inferSelect
export type Product = typeof products.$inferSelect
export type Family = typeof families.$inferSelect
export type Household = typeof households.$inferSelect
export type Member = typeof members.$inferSelect
export type PriceChange = typeof priceChanges.$inferSelect


/** Used to tune the concurrency estimate for shared video logins. */
export const DEFAULT_CONCURRENCY = 0.5
