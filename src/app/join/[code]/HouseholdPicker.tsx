'use client'

import { useState } from 'react'

export function HouseholdPicker({ households }: { households: { id: string; name: string; people: string[] }[] }) {
  const [choice, setChoice] = useState(households[0]?.id ?? 'new')
  return (
    <fieldset>
      <legend className="label">Hvor bor du?</legend>
      <div className="space-y-2">
        {[...households, { id: 'new', name: 'Et andet sted', people: [] }].map((h) => (
          <label
            key={h.id}
            className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition ${choice === h.id ? 'border-ink bg-sunk' : 'border-line-2 hover:border-ink-3'}`}
          >
            <input type="radio" name="householdId" value={h.id} checked={choice === h.id} onChange={() => setChoice(h.id)} className="mt-1 accent-[var(--color-ink)]" />
            <span>
              <span className="block font-medium">{h.name}</span>
              {h.people.length > 0 && <span className="block text-sm text-ink-3">{h.people.join(', ')}</span>}
            </span>
          </label>
        ))}
      </div>
      {choice === 'new' && <input name="newHome" className="input mt-3" placeholder="Hvad kalder du dit hjem?" />}
    </fieldset>
  )
}
