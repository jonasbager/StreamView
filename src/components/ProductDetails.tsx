'use client'

import type { Priced } from '@/lib/engine'
import type { Catalog } from '@/lib/engine'
import { kr } from '@/lib/format'
import { BrandMark } from './BrandMark'

/** Everything a product gives you, for the "Hvad er med?" fold-out. */
export function ProductDetails({ item, cat, usedFor }: { item: Priced; cat: Catalog; usedFor?: string[] }) {
  const a = item.attributes
  const info = item.info
  const svcChip = (sid: string, note?: string) => {
    const s = cat.service.get(sid)
    if (!s) return null
    return (
      <li key={sid} className="flex items-center gap-2">
        <BrandMark id={sid} name={s.name} color={s.color} size={20} />
        <span className="text-ink">{s.name}</span>
        {note && <span className="text-ink-3">{note}</span>}
      </li>
    )
  }
  const capNote = (sid: string, cap: number) =>
    cap >= 99 ? undefined : cat.service.get(sid)?.capacityType === 'seats' ? (cap === 1 ? '1 person' : `op til ${cap} personer`) : `${cap} skærme ad gangen`
  const facts: string[] = []
  if (a.dataGb != null) facts.push(a.dataGb === -1 ? 'Fri data' : `${a.dataGb} GB data`)
  if (a.speedMbit) facts.push(`${a.speedMbit} Mbit`)
  if ((a.lines ?? 1) > 1) facts.push(`${a.lines} mobilabonnementer`)
  if (a.ads === true) facts.push('Med reklamer')
  if (a.ads === false) facts.push('Uden reklamer')
  if (item.bindingMonths) facts.push(`${item.bindingMonths} mdr. binding`)
  if (a.requires === 'student') facts.push('Kun for studerende')
  if (info?.setupFee) facts.push(`Oprettelse ${kr(info.setupFee)}`)
  if (a.extraMember) facts.push(`Ekstra medlem: ${kr(a.extraMember.price)}/md., op til ${a.extraMember.slots}`)

  return (
    <div className="mt-2 space-y-3 rounded-lg bg-sunk px-3 py-3 text-xs leading-relaxed text-ink-2">
      {item.includes.length > 0 && (
        <div>
          <div className="mb-1.5 font-medium text-ink">Indeholder</div>
          <ul className="space-y-1.5">{item.includes.map((i) => svcChip(i.serviceId, capNote(i.serviceId, i.capacity)))}</ul>
        </div>
      )}
      {a.choose && (
        <div>
          <div className="mb-1.5 font-medium text-ink">Vælg {a.choose.count} af</div>
          <ul className="space-y-1.5">
            {a.choose.from.map((sid) => svcChip(sid, usedFor?.includes(sid) ? '· bruges af jer' : undefined))}
          </ul>
        </div>
      )}
      {facts.length > 0 && <div>{facts.join(' · ')}</div>}
      {info?.introPrice != null && (info.introMonths ?? 0) > 0 && (
        <div>
          Intro: {info.introPrice === 0 ? 'gratis' : kr(info.introPrice)} i {info.introMonths} mdr., derefter {kr(info.price)}.
        </div>
      )}
      {item.offerText && <div>{item.offerText}</div>}
      {item.keep && <div>Det abonnement, der betales for i dag, til den pris I har oplyst.</div>}
      <div className="text-ink-3">
        Første år i alt {kr(item.firstYear)}.{' '}
        {item.keep ? '' : info?.verifiedAt ? `Pris bekræftet ${new Date(info.verifiedAt).toLocaleDateString('da-DK', { day: 'numeric', month: 'short' })}.` : 'Prisen er ikke bekræftet endnu.'}
        {info?.sourceUrl && (
          <>
            {' '}
            <a href={info.sourceUrl} target="_blank" rel="noreferrer" className="underline hover:text-ink">Se hos udbyderen</a>
          </>
        )}
      </div>
    </div>
  )
}
