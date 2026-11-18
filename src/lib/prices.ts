import 'server-only'
import { generateText, Output } from 'ai'
import { and, eq, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { db, priceChanges, priceRuns, products, providers, services } from '@/db'
import type { Product, ProposedProduct, Provider } from '@/db/schema'

const MODEL = 'anthropic/claude-sonnet-5.5'
const UA = 'Mozilla/5.0 (compatible; StreamViewPriceBot/1.0; +https://streamview.vercel.app)'
const MAX_PAGES = 4
const MAX_CHARS_PER_PAGE = 30_000

async function fetchPage(url: string) {
  const res = await fetch(url, {
    headers: { 'user-agent': UA, 'accept-language': 'da-DK,da;q=0.9' },
    redirect: 'follow',
    signal: AbortSignal.timeout(20_000),
  })
  if (!res.ok) throw new Error(`${res.status} ${url}`)
  const html = await res.text()
  return { url: res.url, html }
}

/** Visible text plus links, small enough to hand to the model. */
function toText(html: string, base: string) {
  const links = new Map<string, string>()
  for (const m of html.matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    try {
      const href = new URL(m[1], base)
      if (href.hostname !== new URL(base).hostname) continue
      const label = m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
      if (label && !links.has(href.href)) links.set(href.href.split('?')[0], label.slice(0, 80))
    } catch {
      /* bad href */
    }
  }
  // Prices are often in JSON blobs (Next.js data, JSON-LD), so keep those as text.
  const json = [...html.matchAll(/<script[^>]*type=["']application\/(?:ld\+)?json["'][^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]).join('\n')
  const text = html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<noscript[\s\S]*?<\/noscript>|<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<(br|\/p|\/div|\/li|\/h\d|\/tr)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim()
  return { text: (text + '\n' + json).slice(0, MAX_CHARS_PER_PAGE), links: [...links].slice(0, 200) }
}

const pickSchema = z.object({ urls: z.array(z.string()).max(MAX_PAGES - 1) })

const extractSchema = z.object({
  products: z.array(
    z.object({
      name: z.string().describe('Produktets navn som udbyderen kalder det, fx "Standard med reklamer" eller "Fri tale + 50 GB"'),
      category: z.enum(['streaming', 'mobile', 'broadband', 'tv', 'bundle']),
      price: z.number().describe('Normalpris pr. måned i kr. efter evt. introtilbud'),
      introPrice: z.number().nullable().describe('Tilbudspris pr. måned i introperioden, ellers null'),
      introMonths: z.number().int().nullable(),
      setupFee: z.number().describe('Oprettelse/etablering i kr., 0 hvis ingen'),
      bindingMonths: z.number().int().describe('Bindingsperiode i måneder, 0 hvis ingen'),
      includedServiceIds: z.array(z.string()).describe('Streamingtjenester der er inkluderet, som id fra listen'),
      streams: z.number().int().nullable().describe('Samtidige streams eller antal personer, hvis oplyst'),
      ads: z.boolean().nullable(),
      dataGb: z.number().nullable().describe('Mobildata i GB, -1 for fri data'),
      speedMbit: z.number().nullable(),
      lines: z.number().int().nullable().describe('Antal mobilabonnementer i pakken'),
      offerText: z.string().nullable().describe('Kort dansk beskrivelse af et tilbud, hvis der er et'),
      offerEndsAt: z.string().nullable().describe('Slutdato for tilbuddet, YYYY-MM-DD'),
      sourceUrl: z.string(),
    }),
  ),
})

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9æøå]+/g, ' ').trim()

function toProposed(p: z.infer<typeof extractSchema>['products'][number], capacityDefault: number): ProposedProduct {
  return {
    name: p.name,
    category: p.category,
    price: p.price,
    introPrice: p.introPrice,
    introMonths: p.introMonths,
    setupFee: p.setupFee,
    bindingMonths: p.bindingMonths,
    includes: p.includedServiceIds.map((serviceId) => ({ serviceId, capacity: p.streams ?? capacityDefault })),
    attributes: {
      ...(p.ads != null ? { ads: p.ads } : {}),
      ...(p.dataGb != null ? { dataGb: p.dataGb } : {}),
      ...(p.speedMbit != null ? { speedMbit: p.speedMbit } : {}),
      ...(p.lines != null && p.lines > 1 ? { lines: p.lines } : {}),
    },
    offerText: p.offerText,
    offerEndsAt: p.offerEndsAt,
  }
}

function diff(current: Product, next: ProposedProduct) {
  const out: string[] = []
  const fmt = (n: number | null | undefined) => (n == null ? '–' : `${n} kr.`)
  if (Math.abs(current.price - next.price) >= 0.5) out.push(`Pris: ${fmt(current.price)} → ${fmt(next.price)}`)
  if ((current.introPrice ?? null) !== (next.introPrice ?? null) || (current.introMonths ?? null) !== (next.introMonths ?? null))
    out.push(`Introtilbud: ${current.introPrice != null ? `${current.introPrice} kr. i ${current.introMonths} mdr.` : 'ingen'} → ${next.introPrice != null ? `${next.introPrice} kr. i ${next.introMonths} mdr.` : 'ingen'}`)
  if (current.setupFee !== next.setupFee) out.push(`Oprettelse: ${fmt(current.setupFee)} → ${fmt(next.setupFee)}`)
  if (current.bindingMonths !== next.bindingMonths) out.push(`Binding: ${current.bindingMonths} → ${next.bindingMonths} mdr.`)
  const inc = (x: { serviceId: string }[]) => x.map((i) => i.serviceId).sort().join(',')
  if (next.includes.length && inc(current.includes) !== inc(next.includes)) out.push(`Indhold: ${inc(current.includes) || '–'} → ${inc(next.includes)}`)
  if ((current.offerText ?? '') !== (next.offerText ?? '') && next.offerText) out.push(`Tilbud: ${next.offerText}`)
  return out
}

async function runProvider(provider: Provider, runId: string, serviceIds: string[]) {
  const home = await fetchPage(provider.priceUrls[0] ?? provider.url)
  const homeText = toText(home.html, home.url)
  const known = provider.priceUrls.slice(1)

  // Let the model pick the pages with prices, unless we already know them.
  let urls = known
  if (!urls.length) {
    const { output } = await generateText({
      model: MODEL,
      output: Output.object({ schema: pickSchema }),
      prompt: `Du ser forsiden for ${provider.name} (${home.url}). Vælg op til ${MAX_PAGES - 1} links fra listen, der mest sandsynligt viser priser på ${
        provider.kind === 'streaming' ? 'abonnementer/planer' : 'mobilabonnementer, internet, tv-pakker og streamingpakker'
      }. Svar kun med URL'er fra listen.\n\n${homeText.links.map(([u, l]) => `${l}: ${u}`).join('\n')}`,
    })
    urls = output.urls.filter((u) => homeText.links.some(([x]) => x === u))
  }

  const pages = [{ url: home.url, text: homeText.text }]
  for (const u of urls.slice(0, MAX_PAGES - 1)) {
    try {
      const p = await fetchPage(u)
      pages.push({ url: p.url, text: toText(p.html, p.url).text })
    } catch {
      /* skip pages that fail */
    }
  }

  const { output } = await generateText({
    model: MODEL,
    output: Output.object({ schema: extractSchema }),
    system: `Du udtrækker aktuelle danske priser fra udbyderes hjemmesider til en prissammenligning.
Medtag kun produkter, hvor prisen står på siden. Gæt aldrig en pris. Priser i kr. pr. måned inkl. moms.
Hvis siden ikke viser priser, så returnér en tom liste.
Streamingtjenesternes id'er: ${serviceIds.join(', ')}.`,
    prompt: pages.map((p) => `### ${p.url}\n${p.text}`).join('\n\n'),
  })

  const found = output.products.filter((p) => p.price > 0 || p.category === 'streaming')
  const existing = await db.select().from(products).where(eq(products.providerId, provider.id))
  const capacityDefault = provider.kind === 'streaming' ? 2 : 1

  // Supersede older pending changes from this provider.
  await db
    .update(priceChanges)
    .set({ status: 'rejected' })
    .where(and(eq(priceChanges.providerId, provider.id), eq(priceChanges.status, 'pending')))

  let verified = 0
  let changes = 0
  const matched = new Set<string>()
  for (const f of found) {
    const proposed = toProposed(f, capacityDefault)
    if (provider.kind === 'streaming' && !proposed.includes.length) proposed.includes = [{ serviceId: provider.id, capacity: f.streams ?? capacityDefault }]
    const match = existing.find((e) => !matched.has(e.id) && e.category === proposed.category && norm(e.name) === norm(proposed.name))
      ?? existing.find((e) => !matched.has(e.id) && e.category === proposed.category && (norm(e.name).includes(norm(proposed.name)) || norm(proposed.name).includes(norm(e.name))))
    if (match) {
      matched.add(match.id)
      const d = diff(match, proposed)
      if (!d.length) {
        await db.update(products).set({ verifiedAt: new Date().toISOString(), sourceUrl: f.sourceUrl, active: true }).where(eq(products.id, match.id))
        verified++
        continue
      }
      await db.insert(priceChanges).values({ id: crypto.randomUUID(), runId, providerId: provider.id, kind: 'update', productId: match.id, proposed, diff: d, sourceUrl: f.sourceUrl })
    } else {
      await db.insert(priceChanges).values({
        id: crypto.randomUUID(), runId, providerId: provider.id, kind: 'new', proposed,
        diff: [`Ny: ${proposed.name} til ${proposed.price} kr./md.`], sourceUrl: f.sourceUrl,
      })
    }
    changes++
  }
  // Only suggest removals when the page clearly listed this category.
  if (found.length >= 2) {
    const seenCategories = new Set(found.map((f) => f.category))
    for (const e of existing.filter((e) => e.active && !matched.has(e.id) && seenCategories.has(e.category))) {
      await db.insert(priceChanges).values({ id: crypto.randomUUID(), runId, providerId: provider.id, kind: 'gone', productId: e.id, diff: [`Ikke fundet længere: ${e.name}`] })
      changes++
    }
  }

  // Remember the pages that worked, so next week skips the link-picking step.
  if (!known.length && pages.length > 1) {
    await db.update(providers).set({ priceUrls: [provider.priceUrls[0] ?? provider.url, ...pages.slice(1).map((p) => p.url)] }).where(eq(providers.id, provider.id))
  }
  return `${found.length} fundet, ${verified} bekræftet uændret, ${changes} ændringer til godkendelse`
}

export async function runPriceJob(trigger: 'cron' | 'manual', providerIds?: string[]) {
  const runId = crypto.randomUUID()
  await db.insert(priceRuns).values({ id: runId, trigger })
  const list = providerIds?.length
    ? await db.select().from(providers).where(inArray(providers.id, providerIds))
    : await db.select().from(providers)
  const serviceIds = (await db.select({ id: services.id }).from(services)).map((s) => s.id)

  const log: { providerId: string; ok: boolean; message: string }[] = []
  const queue = [...list]
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      for (let p = queue.shift(); p; p = queue.shift()) {
        try {
          log.push({ providerId: p.id, ok: true, message: await runProvider(p, runId, serviceIds) })
        } catch (e) {
          log.push({ providerId: p.id, ok: false, message: e instanceof Error ? e.message : String(e) })
        }
      }
    }),
  )
  await db.update(priceRuns).set({ finishedAt: new Date().toISOString(), log }).where(eq(priceRuns.id, runId))
  return { runId, log }
}

const slug = (s: string) => norm(s).replace(/ /g, '-').slice(0, 40)

export async function applyChange(changeId: string, approve: boolean) {
  const [c] = await db.select().from(priceChanges).where(eq(priceChanges.id, changeId))
  if (!c || c.status !== 'pending') return
  if (approve) {
    const now = new Date().toISOString()
    if (c.kind === 'new' && c.proposed) {
      await db.insert(products).values({
        id: `${c.providerId}-${slug(c.proposed.name)}-${crypto.randomUUID().slice(0, 4)}`,
        providerId: c.providerId,
        ...c.proposed,
        sourceUrl: c.sourceUrl,
        verifiedAt: now,
        updatedAt: now,
      })
    } else if (c.kind === 'update' && c.productId && c.proposed) {
      const { name: _n, ...fields } = c.proposed
      const [cur] = await db.select().from(products).where(eq(products.id, c.productId))
      // Keep attributes the page doesn't show (extra members, annual price).
      fields.attributes = { ...(cur?.attributes ?? {}), ...fields.attributes }
      if (!fields.includes.length && cur) fields.includes = cur.includes
      await db.update(products).set({ ...fields, sourceUrl: c.sourceUrl, verifiedAt: now, updatedAt: now, active: true }).where(eq(products.id, c.productId))
    } else if (c.kind === 'gone' && c.productId) {
      await db.update(products).set({ active: false, updatedAt: now }).where(eq(products.id, c.productId))
    }
  }
  await db.update(priceChanges).set({ status: approve ? 'approved' : 'rejected' }).where(eq(priceChanges.id, changeId))
}
