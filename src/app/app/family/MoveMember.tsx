'use client'

import { useTransition } from 'react'
import { moveMember } from '../actions'

export function MoveMember({ memberId, householdId, households }: { memberId: string; householdId: string; households: { id: string; name: string }[] }) {
  const [pending, start] = useTransition()
  if (households.length < 2) return null
  return (
    <select
      aria-label="Flyt til hjem"
      className="hidden h-8 rounded-full border border-line-2 bg-card px-2.5 text-sm text-ink-2 sm:block"
      value={householdId}
      disabled={pending}
      onChange={(e) => start(() => moveMember(memberId, e.target.value))}
    >
      {households.map((h) => (
        <option key={h.id} value={h.id}>{h.name}</option>
      ))}
    </select>
  )
}
