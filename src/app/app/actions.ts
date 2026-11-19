'use server'

import { currentUser } from '@clerk/nextjs/server'
import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { db, families, households, members } from '@/db'
import type { Answers, Board, FamilySettings } from '@/db/schema'
import { myMembership, requireFamily, requireUser } from '@/lib/data'

const id = () => crypto.randomUUID()
const code = () => crypto.randomUUID().replace(/-/g, '').slice(0, 10)

export async function createFamily(form: FormData) {
  const userId = await requireUser()
  if (await myMembership()) redirect('/app')
  const user = await currentUser()
  const familyName = String(form.get('familyName') || '').trim() || 'Min familie'
  const homeName = String(form.get('homeName') || '').trim() || 'Hjemme'
  const myName = String(form.get('myName') || '').trim() || user?.firstName || 'Mig'

  const familyId = id()
  const householdId = id()
  await db.insert(families).values({ id: familyId, name: familyName, ownerUserId: userId, inviteCode: code() })
  await db.insert(households).values({ id: householdId, familyId, name: homeName })
  await db.insert(members).values({ id: id(), familyId, householdId, userId, name: myName })
  redirect('/app/onboarding')
}

export async function joinFamily(inviteCode: string, form: FormData) {
  const userId = await requireUser()
  if (await myMembership()) redirect('/app')
  const [family] = await db.select().from(families).where(eq(families.inviteCode, inviteCode))
  if (!family) redirect('/app/start')
  const user = await currentUser()
  const myName = String(form.get('myName') || '').trim() || user?.firstName || 'Ny'
  let householdId = String(form.get('householdId') || '')
  const newHome = String(form.get('newHome') || '').trim()

  if (householdId === 'new' || !householdId) {
    householdId = id()
    await db.insert(households).values({ id: householdId, familyId: family.id, name: newHome || `${myName}s hjem` })
  } else {
    const [h] = await db.select().from(households).where(and(eq(households.id, householdId), eq(households.familyId, family.id)))
    if (!h) redirect(`/join/${inviteCode}`)
  }

  // Claim a placeholder member the organiser created with the same name, if any.
  const [placeholder] = await db
    .select()
    .from(members)
    .where(and(eq(members.familyId, family.id), eq(members.name, myName)))
  if (placeholder && !placeholder.userId) {
    await db.update(members).set({ userId, householdId }).where(eq(members.id, placeholder.id))
  } else {
    await db.insert(members).values({ id: id(), familyId: family.id, householdId, userId, name: myName })
  }
  redirect('/app/onboarding')
}

const billSchema = z
  .object({
    providerId: z.string().nullable(),
    other: z.string().optional(),
    monthly: z.number().nonnegative().nullable(),
    bindingLeft: z.number().int().nonnegative().nullable().optional(),
  })
  .nullable()

const answersSchema = z.object({
  paysFor: z.array(
    z.object({
      serviceId: z.string(),
      monthly: z.number().nonnegative().nullable(),
      productId: z.string().nullable().optional(),
      via: z.enum(['self', 'mobile', 'broadband', 'tv', 'other']).optional(),
    }),
  ),
  wants: z.array(z.string()),
  mustHave: z.array(z.string()).optional(),
  mobile: billSchema,
  broadband: billSchema,
  tv: billSchema,
  willingToSwitch: z.enum(['yes', 'if-worth-it', 'no']),
  dataNeed: z.enum(['low', 'mid', 'high']),
  adsOk: z.boolean(),
  student: z.boolean(),
})

/** Save answers for yourself, or (organiser) for a family member without a login. */
export async function saveAnswers(memberId: string | null, name: string, answers: Answers) {
  const { me, family } = await requireFamily()
  const parsed = answersSchema.parse(answers)
  const targetId = memberId ?? me.id
  const [target] = await db.select().from(members).where(and(eq(members.id, targetId), eq(members.familyId, family.id)))
  if (!target) throw new Error('Ukendt familiemedlem')
  if (target.userId && target.userId !== me.userId) throw new Error('Kun personen selv kan ændre sine svar')
  await db
    .update(members)
    .set({ answers: parsed, name: name.trim() || target.name, onboardedAt: new Date().toISOString() })
    .where(eq(members.id, targetId))
  revalidatePath('/app', 'layout')
}

export async function addPlaceholderMember(form: FormData) {
  const { family, households: hs } = await requireFamily()
  const name = String(form.get('name') || '').trim()
  const householdId = String(form.get('householdId') || hs[0]?.id)
  if (!name || !hs.some((h) => h.id === householdId)) return
  const memberId = id()
  await db.insert(members).values({ id: memberId, familyId: family.id, householdId, name })
  redirect(`/app/onboarding?for=${memberId}`)
}

export async function addHousehold(form: FormData) {
  const { family } = await requireFamily()
  const name = String(form.get('name') || '').trim()
  if (!name) return
  await db.insert(households).values({ id: id(), familyId: family.id, name })
  revalidatePath('/app/family')
}

export async function moveMember(memberId: string, householdId: string) {
  const { family, households: hs } = await requireFamily()
  if (!hs.some((h) => h.id === householdId)) return
  await db.update(members).set({ householdId }).where(and(eq(members.id, memberId), eq(members.familyId, family.id)))
  revalidatePath('/app', 'layout')
}

export async function removeMember(memberId: string) {
  const { family, me } = await requireFamily()
  if (family.ownerUserId !== me.userId || memberId === me.id) return
  await db.delete(members).where(and(eq(members.id, memberId), eq(members.familyId, family.id)))
  revalidatePath('/app', 'layout')
}

const boardSchema = z.object({
  packages: z.array(
    z.object({
      id: z.string(),
      name: z.string().max(80),
      householdId: z.string(),
      productIds: z.array(z.string()).max(40),
      memberIds: z.array(z.string()).max(40),
    }),
  ),
})

export async function saveBoard(board: Pick<Board, 'packages'>) {
  const { family } = await requireFamily()
  const parsed = boardSchema.parse(board)
  await db
    .update(families)
    .set({ board: { packages: parsed.packages, updatedAt: new Date().toISOString() } })
    .where(eq(families.id, family.id))
}

export async function renameFamily(form: FormData) {
  const { family, me } = await requireFamily()
  if (family.ownerUserId !== me.userId) return
  const name = String(form.get('name') || '').trim()
  if (name) await db.update(families).set({ name }).where(eq(families.id, family.id))
  revalidatePath('/app', 'layout')
}

const settingsSchema = z.object({
  budget: z.number().nonnegative().max(100000).nullable(),
  tolerance: z.enum(['none', 'low', 'medium', 'high', 'strict']),
  adsOk: z.boolean(),
  allowBinding: z.boolean(),
  switchTelco: z.boolean(),
})

export async function saveSettings(settings: FamilySettings) {
  const { family } = await requireFamily()
  await db.update(families).set({ settings: settingsSchema.parse(settings) }).where(eq(families.id, family.id))
}

/** Open the budget setup the family picked in the package builder. */
export async function openBoard(board: Pick<Board, 'packages'>) {
  await saveBoard(board)
  redirect('/app/builder')
}

/** Plain-Danish explanation of a setup: what changes for whom and what to do. */
export async function explainBoard(board: Pick<Board, 'packages'>, mode: 'legal' | 'bend') {
  const { ctx } = await requireFamily()
  const { explain } = await import('@/lib/recommend')
  return explain(ctx, boardSchema.parse(board).packages, mode)
}
