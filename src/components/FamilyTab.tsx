import type { AppState, Service } from '../lib/types'
import { uid } from '../lib/store'
import { Avatar, Card, houseColor, ServiceLogo } from './ui'

interface Props {
  state: AppState
  setState: (fn: (s: AppState) => AppState) => void
  services: Service[]
}

export function FamilyTab({ state, setState, services }: Props) {
  const { households, members } = state
  const hIndex = new Map(households.map((h, i) => [h.id, i]))

  const addHousehold = () =>
    setState((s) => ({ ...s, households: [...s.households, { id: uid(), name: `Home ${s.households.length + 1}` }] }))

  const renameHousehold = (id: string, name: string) =>
    setState((s) => ({ ...s, households: s.households.map((h) => (h.id === id ? { ...h, name } : h)) }))

  const removeHousehold = (id: string) =>
    setState((s) => {
      const rest = s.households.filter((h) => h.id !== id)
      if (!rest.length) return s
      return {
        ...s,
        households: rest,
        members: s.members.map((m) => (m.householdId === id ? { ...m, householdId: rest[0].id } : m)),
      }
    })

  const addMember = (householdId: string) =>
    setState((s) => ({
      ...s,
      members: [...s.members, { id: uid(), name: `Person ${s.members.length + 1}`, householdId, wants: ['drtv'] }],
    }))

  const updateMember = (id: string, patch: Partial<(typeof members)[number]>) =>
    setState((s) => ({ ...s, members: s.members.map((m) => (m.id === id ? { ...m, ...patch } : m)) }))

  const removeMember = (id: string) => setState((s) => ({ ...s, members: s.members.filter((m) => m.id !== id) }))

  const toggleWant = (memberId: string, serviceId: string) =>
    setState((s) => ({
      ...s,
      members: s.members.map((m) =>
        m.id !== memberId
          ? m
          : { ...m, wants: m.wants.includes(serviceId) ? m.wants.filter((w) => w !== serviceId) : [...m.wants, serviceId] },
      ),
    }))

  return (
    <div className="space-y-8">
      <section>
        <div className="mb-3 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Households</h2>
            <p className="text-sm text-slate-400">
              A household is one address. Most services only allow sharing inside one household.
            </p>
          </div>
          <button onClick={addHousehold} className="btn-primary shrink-0">
            + Household
          </button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {households.map((h, i) => {
            const people = members.filter((m) => m.householdId === h.id)
            return (
              <Card key={h.id} className="p-4">
                <div className="flex items-center gap-2">
                  <span className="size-3 rounded-full" style={{ background: houseColor(i) }} />
                  <input
                    value={h.name}
                    onChange={(e) => renameHousehold(h.id, e.target.value)}
                    className="min-w-0 flex-1 bg-transparent font-medium text-white outline-none focus:underline"
                    aria-label="Household name"
                  />
                  {households.length > 1 && (
                    <button
                      onClick={() => removeHousehold(h.id)}
                      className="text-xs text-slate-500 hover:text-rose-300"
                      title="Remove household (members move to the first household)"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  {people.map((p) => (
                    <span key={p.id} className="rounded-full bg-white/5 px-2 py-0.5 text-xs">
                      {p.name}
                    </span>
                  ))}
                  <button onClick={() => addMember(h.id)} className="rounded-full px-2 py-0.5 text-xs text-indigo-300 hover:bg-indigo-500/10">
                    + person
                  </button>
                </div>
              </Card>
            )
          })}
        </div>
      </section>

      <section>
        <div className="mb-3">
          <h2 className="text-lg font-semibold text-white">Who wants what?</h2>
          <p className="text-sm text-slate-400">Tick the services each person actually uses.</p>
        </div>

        {members.length === 0 ? (
          <Card className="p-8 text-center text-slate-400">
            No one here yet. <button className="text-indigo-300 underline" onClick={() => addMember(households[0].id)}>Add the first person</button>
          </Card>
        ) : (
          <Card className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-white/8">
                  <th className="sticky left-0 z-10 min-w-56 bg-[#101219] p-3 text-left font-medium text-slate-400">Person</th>
                  {services.map((s) => (
                    <th key={s.id} className="p-2 align-bottom">
                      <div className="flex flex-col items-center gap-1.5">
                        <ServiceLogo service={s} size={28} />
                        <span className="w-16 text-center text-[11px] leading-tight font-normal text-slate-400">{s.name}</span>
                      </div>
                    </th>
                  ))}
                  <th />
                </tr>
              </thead>
              <tbody>
                {members.map((m) => {
                  const hi = hIndex.get(m.householdId) ?? 0
                  return (
                    <tr key={m.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                      <td className="sticky left-0 z-10 bg-[#101219] p-2">
                        <div className="flex items-center gap-2">
                          <Avatar name={m.name} color={houseColor(hi)} />
                          <div className="min-w-0 flex-1">
                            <input
                              value={m.name}
                              onChange={(e) => updateMember(m.id, { name: e.target.value })}
                              className="w-full bg-transparent text-white outline-none focus:underline"
                              aria-label="Name"
                            />
                            <select
                              value={m.householdId}
                              onChange={(e) => updateMember(m.id, { householdId: e.target.value })}
                              className="w-full cursor-pointer bg-transparent text-xs text-slate-400 outline-none"
                              aria-label="Household"
                            >
                              {households.map((h) => (
                                <option key={h.id} value={h.id} className="bg-slate-900">
                                  {h.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </td>
                      {services.map((s) => {
                        const on = m.wants.includes(s.id)
                        return (
                          <td key={s.id} className="p-1 text-center">
                            <button
                              onClick={() => toggleWant(m.id, s.id)}
                              aria-pressed={on}
                              aria-label={`${m.name} wants ${s.name}`}
                              className={`size-8 rounded-lg border transition ${
                                on ? 'border-transparent text-white' : 'border-white/10 text-transparent hover:border-white/30'
                              }`}
                              style={on ? { background: s.color } : undefined}
                            >
                              ✓
                            </button>
                          </td>
                        )
                      })}
                      <td className="p-2 text-right">
                        <button onClick={() => removeMember(m.id)} className="text-slate-500 hover:text-rose-300" aria-label={`Remove ${m.name}`}>
                          ✕
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </Card>
        )}
      </section>
    </div>
  )
}
