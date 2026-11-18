'use server'

import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db, priceChanges, providers } from '@/db'
import { isAdmin } from '@/lib/data'
import { applyChange, runPriceJob } from '@/lib/prices'

async function guard() {
  if (!(await isAdmin())) throw new Error('Kun for administratorer')
}

export async function decide(changeId: string, approve: boolean) {
  await guard()
  await applyChange(changeId, approve)
  revalidatePath('/admin')
}

export async function approveAll(providerId: string) {
  await guard()
  const pending = await db.select().from(priceChanges).where(and(eq(priceChanges.providerId, providerId), eq(priceChanges.status, 'pending')))
  for (const c of pending) await applyChange(c.id, true)
  revalidatePath('/admin')
}

export async function runNow(providerId?: string) {
  await guard()
  await runPriceJob('manual', providerId ? [providerId] : undefined)
  revalidatePath('/admin')
}

export async function setPriceUrls(providerId: string, form: FormData) {
  await guard()
  const urls = String(form.get('urls') || '')
    .split(/\s+/)
    .map((u) => u.trim())
    .filter((u) => /^https?:\/\//.test(u))
  if (urls.length) await db.update(providers).set({ priceUrls: urls }).where(eq(providers.id, providerId))
  revalidatePath('/admin')
}
