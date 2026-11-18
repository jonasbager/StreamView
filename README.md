# StreamView

Plan the cheapest streaming setup for the whole family.

Add your households and family members, tick the services each person wants, and StreamView works out the cheapest mix of plans, family plans, bundles and official "extra member" add-ons. It shows three numbers:

| Scenario | What it means |
| --- | --- |
| **Everyone pays for their own** | Baseline: no sharing at all. |
| **Smart & by the rules** | Shares only where the terms allow it: inside a household, through Apple Family Sharing, or with paid extra members such as Netflix's. |
| **Bending the rules** | Also shares logins across homes, but only for services whose enforcement is at or below the risk level you choose. Every rule-bending item is flagged with how hard that service clamps down. |

Each service has an enforcement rating (*sharing allowed → barely → sometimes → actively → strictly enforced*), with an explanation of what it actually does to stop sharing and what the official alternative is.

## Features

- Households and members, with a who-wants-what matrix
- A Danish service catalog (DKK) with editable prices, ad tiers, annual billing, stream and seat limits
- Bundles (Apple One) plus your own deals (telco packages, mobile plans with streaming included)
- Settings for risk tolerance, the share of people watching at the same time, and whether ads are OK
- A fair per-person cost split, and a link that shares your whole setup with family
- Everything is stored locally in the browser. There is no backend.

## How the optimiser works

`src/lib/optimizer.ts` runs a minimum-cost set cover (a bitmask DP) for each household. Services that may be shared across homes in the current scenario go into a shared pool instead. Video plans are sized by simultaneous streams (people × concurrency); music and family plans are sized by seats. A second pass swaps a home's own plan for an extra-member slot on another home's plan when that is cheaper.

## Develop

```bash
npm install
npm run dev     # http://localhost:5173
npm test        # optimiser unit tests
npm run build   # static site in dist/ (deploy anywhere, e.g. Vercel)
```

Prices in `src/data/catalog.ts` are approximate (late 2025) and change often. Correct them in the app or in that file.
