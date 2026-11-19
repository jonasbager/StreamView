import type { VercelConfig } from '@vercel/config/v1'

export const config: VercelConfig = {
  framework: 'nextjs',
  // Daily at 04:17 UTC; each run checks providers not checked for 6 days, so each is refreshed weekly.
  crons: [{ path: '/api/cron/prices', schedule: '17 4 * * *' }],
}
