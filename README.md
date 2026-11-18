# StreamView

Hele familiens streaming, mobil, internet og TV, samlet og billigere. A web app for Danish families: everyone answers four short questions, StreamView works out what the family pays today, and suggests the cheapest setup. It shows a by-the-rules setup and a "grey zone" setup (sharing logins across homes) side by side, with an honest rating of how hard each service enforces its sharing rules. Families can then drag services and people between packages and see the price change live.

## Stack

- Next.js 16 (App Router) on Vercel
- Clerk for login (Marketplace integration), with Danish localisation
- Neon Postgres + Drizzle ORM (Marketplace integration)
- Vercel AI Gateway (`anthropic/claude-sonnet-5.5`) via the AI SDK, for recommendations and price extraction
- dnd-kit for the package builder
- Vercel Cron: weekly price job (`vercel.ts`)

## How it works

| Part | Where |
| --- | --- |
| Questionnaire (paid subscriptions, wanted services, mobile/internet/TV, willingness to switch) | `src/app/app/onboarding` |
| Invites: share `/join/<code>`, pick or create a home | `src/app/join/[code]` |
| Pricing engine: evaluates any set of packages (coverage, capacity, cross-home risk, first-year cost) and builds legal / grey-zone setups | `src/lib/engine.ts` |
| AI recommendations: refines the computed setups and explains them in Danish. Every price is recomputed by the engine, never taken from the model | `src/lib/recommend.ts` |
| Drag-and-drop package builder with autosave | `src/app/app/builder` |
| Weekly price job: reads each provider's site, AI-extracts plans and offers, auto-confirms unchanged prices, queues changes for review | `src/lib/prices.ts`, `src/app/api/cron/prices` |
| Admin review queue | `src/app/admin` (users listed in `ADMIN_EMAILS`) |

## Environment

Provisioned by the Vercel integrations: `DATABASE_URL`, `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `VERCEL_OIDC_TOKEN` (AI Gateway).
Set yourself: `CRON_SECRET` (done), `ADMIN_EMAILS` (comma-separated emails allowed on `/admin`).

## Develop

```bash
vercel env pull .env.local
npm install
npm run db:migrate   # apply drizzle/*.sql
npm run db:seed      # starting catalog (unverified prices until the first price run)
npm run dev
npm test             # engine tests
```

After a schema change: `npm run db:generate && npm run db:migrate`.

`/dev-preview/*` renders the builder, questionnaire and landing page with an example family in development (404 in production).
