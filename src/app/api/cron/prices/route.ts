import { runPriceJob } from '@/lib/prices'

export const maxDuration = 300

/** Called weekly by Vercel Cron (see vercel.ts). */
export async function GET(req: Request) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }
  // ?providers=cbb,telmore re-checks specific providers now.
  const only = new URL(req.url).searchParams.get('providers')?.split(',').filter(Boolean)
  const result = await runPriceJob(only?.length ? 'manual' : 'cron', only)
  return Response.json(result)
}
