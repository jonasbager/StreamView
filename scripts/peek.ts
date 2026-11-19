import { config } from 'dotenv'
config({ path: '.env.local' })
async function main() {
  const { db, priceChanges, products } = await import('../src/db')
  const { eq } = await import('drizzle-orm')
  const rows = await db.select().from(priceChanges).where(eq(priceChanges.status, 'pending')).orderBy(priceChanges.providerId)
  const prods = await db.select().from(products)
  for (const r of rows) {
    const p = r.proposed
    const cur = prods.find((x) => x.id === r.productId)
    const extra = p ? [p.category, p.introPrice != null ? `intro ${p.introPrice}x${p.introMonths}` : '', p.bindingMonths ? `bind ${p.bindingMonths}` : '', p.setupFee ? `fee ${p.setupFee}` : '', p.includes.map((i) => i.serviceId).join('+'), JSON.stringify(p.attributes)].filter(Boolean).join(' ') : ''
    console.log([r.id.slice(0, 8), r.providerId, r.kind, (p?.name ?? cur?.name ?? '').slice(0, 45), p ? p.price : '', '|', r.diff.join('; ').slice(0, 90), '|', extra.slice(0, 90)].join(' '))
  }
}
main()
