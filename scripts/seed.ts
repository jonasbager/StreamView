import { config } from 'dotenv'
config({ path: '.env.local' })

async function main() {
  const { db, services, providers, products } = await import('../src/db')
  const { SERVICES, PROVIDERS, PRODUCTS } = await import('../src/db/seed-data')
  const { sql } = await import('drizzle-orm')

  for (const [i, s] of SERVICES.entries()) {
    await db.insert(services).values({ ...s, sort: i }).onConflictDoUpdate({ target: services.id, set: { ...s, sort: i } })
  }
  for (const p of PROVIDERS) {
    // Keep price URLs an admin may have edited.
    await db
      .insert(providers)
      .values(p)
      .onConflictDoUpdate({ target: providers.id, set: { name: p.name, kind: p.kind, color: p.color, url: p.url, offers: p.offers } })
  }
  for (const p of PRODUCTS) {
    // Never overwrite a product the price job has already verified.
    await db
      .insert(products)
      .values(p)
      .onConflictDoUpdate({ target: products.id, set: { ...p }, setWhere: sql`${products.verifiedAt} is null` })
  }
  console.log(`seeded ${SERVICES.length} services, ${PROVIDERS.length} providers, ${PRODUCTS.length} products`)
}
main()
