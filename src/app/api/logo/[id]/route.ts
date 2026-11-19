import { eq } from 'drizzle-orm'
import { db, providers } from '@/db'

const ALIAS: Record<string, string> = { viaplaysport: 'viaplay', tv2sport: 'tv2play' }
const UA = 'Mozilla/5.0 (compatible; StreamViewLogoBot/1.0)'

/** Finds the provider's own app icon (apple-touch-icon, else largest icon, else favicon). */
async function findIcon(siteUrl: string) {
  const res = await fetch(siteUrl, { headers: { 'user-agent': UA }, redirect: 'follow', signal: AbortSignal.timeout(8000) })
  const html = await res.text()
  const icons: { href: string; score: number }[] = []
  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = m[0]
    const rel = /rel=["']([^"']+)["']/i.exec(tag)?.[1].toLowerCase() ?? ''
    const href = /href=["']([^"']+)["']/i.exec(tag)?.[1]
    if (!href || !/icon/.test(rel)) continue
    const size = Number(/sizes=["'](\d+)x\d+/i.exec(tag)?.[1] ?? 0)
    const score = (rel.includes('apple-touch-icon') ? 1000 : 0) + (size || (href.endsWith('.svg') ? 500 : 16))
    icons.push({ href: new URL(href, res.url).href, score })
  }
  icons.sort((a, b) => b.score - a.score)
  return [...icons.map((i) => i.href), new URL('/favicon.ico', res.url).href]
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [p] = await db.select().from(providers).where(eq(providers.id, ALIAS[id] ?? id))
  if (!p) return new Response('Not found', { status: 404 })
  try {
    for (const url of (await findIcon(p.url)).slice(0, 4)) {
      const img = await fetch(url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(8000) })
      const type = img.headers.get('content-type') ?? ''
      if (!img.ok || !/^image\//.test(type)) continue
      return new Response(await img.arrayBuffer(), {
        headers: { 'content-type': type, 'cache-control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800' },
      })
    }
  } catch {
    /* fall through */
  }
  return new Response('No icon', { status: 404, headers: { 'cache-control': 'public, s-maxage=86400' } })
}
