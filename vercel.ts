import type { VercelConfig } from '@vercel/config/v1'

export const config: VercelConfig = {
  framework: 'nextjs',
  // Weekly price check: Mondays 04:17 UTC.
  crons: [{ path: '/api/cron/prices', schedule: '17 4 * * 1' }],
}
