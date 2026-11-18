import 'server-only'
import { notFound } from 'next/navigation'
import { loadCatalog } from '@/lib/data'
import type { Answers, Member } from '@/db/schema'
import type { Ctx } from '@/lib/engine'

/** Example family for visual checks in development only. */
export async function fixtureCtx(): Promise<Ctx> {
  if (process.env.NODE_ENV === 'production') notFound()
  const base: Answers = { paysFor: [], wants: [], mobile: null, broadband: null, tv: null, willingToSwitch: 'yes', dataNeed: 'mid', adsOk: true, student: false }
  const m = (id: string, name: string, householdId: string, a: Partial<Answers>): Member => ({ id, familyId: 'f', householdId, userId: null, name, answers: { ...base, ...a }, onboardedAt: '', createdAt: '' })
  return {
    ...(await loadCatalog()),
    households: [
      { id: 'home', familyId: 'f', name: 'Hjemme på Østerbro' },
      { id: 'gran', familyId: 'f', name: 'Mormor og morfar' },
    ],
    members: [
      m('anna', 'Anna', 'home', { wants: ['netflix', 'hbomax', 'spotify', 'tv2play'], paysFor: [{ serviceId: 'netflix', monthly: 179 }, { serviceId: 'spotify', monthly: 189 }], mobile: { providerId: 'telia', monthly: 299 }, broadband: { providerId: 'yousee', monthly: 449 } }),
      m('peter', 'Peter', 'home', { wants: ['netflix', 'viaplay', 'viaplaysport', 'spotify'], paysFor: [{ serviceId: 'viaplay', monthly: 449 }], mobile: { providerId: 'telia', monthly: 299 }, dataNeed: 'high' }),
      m('emma', 'Emma', 'home', { wants: ['disney', 'spotify', 'youtube'], student: true, mobile: { providerId: 'telmore', monthly: 129 } }),
      m('mormor', 'Mormor', 'gran', { wants: ['tv2play', 'netflix', 'drtv'], paysFor: [{ serviceId: 'tv2play', monthly: 149 }], tv: { providerId: 'yousee', monthly: 399 }, willingToSwitch: 'no' }),
    ],
  }
}
