import { runPriceJob } from '@/lib/prices'

export const maxDuration = 300

/** Called weekly by Vercel Cron (see vercel.ts). */
export async function GET(req: Request) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }
  const result = await runPriceJob('cron')
  return Response.json(result)
}
