import 'server-only'
import { auth, currentUser } from '@clerk/nextjs/server'
import { and, asc, eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { db, families, households, members, products, providers, services } from '@/db'
import type { Ctx } from './engine'

export async function requireUser() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')
  return userId
}

export async function loadCatalog() {
  const [s, p, pr] = await Promise.all([
    db.select().from(services).orderBy(asc(services.sort)),
    db.select().from(products).where(eq(products.active, true)),
    db.select().from(providers),
  ])
  return { services: s, products: p, providers: pr }
}

/** The signed-in user's member row and family, or null if they haven't joined one. */
export async function myMembership() {
  const userId = await requireUser()
  const [row] = await db.select().from(members).where(eq(members.userId, userId)).limit(1)
  if (!row) return null
  const [family] = await db.select().from(families).where(eq(families.id, row.familyId))
  return { me: row, family, userId }
}

export async function requireFamily() {
  const m = await myMembership()
  if (!m) redirect('/app/start')
  const [hs, ms, catalog] = await Promise.all([
    db.select().from(households).where(eq(households.familyId, m.family.id)).orderBy(asc(households.name)),
    db.select().from(members).where(eq(members.familyId, m.family.id)).orderBy(asc(members.createdAt)),
    loadCatalog(),
  ])
  const ctx: Ctx = { ...catalog, households: hs, members: ms }
  return { ...m, households: hs, members: ms, ctx }
}

export async function isAdmin() {
  const user = await currentUser()
  const admins = (process.env.ADMIN_EMAILS ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
  return !!user && user.emailAddresses.some((e) => admins.includes(e.emailAddress.toLowerCase()))
}

export async function memberInFamily(memberId: string, familyId: string) {
  const [m] = await db.select().from(members).where(and(eq(members.id, memberId), eq(members.familyId, familyId)))
  return m ?? null
}
