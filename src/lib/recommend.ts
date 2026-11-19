import 'server-only'
import { generateText, Output } from 'ai'
import { z } from 'zod'
import type { BoardPackage } from '@/db/schema'
import { AI_MODEL, aiProviderOptions } from './ai'
import { answersOf, Catalog, evaluate, KEEP_PREFIX, type Ctx } from './engine'

function describeFamily(ctx: Ctx, cat: Catalog) {
  return ctx.members.map((m) => {
    const a = answersOf(m)
    return {
      memberId: m.id,
      name: m.name,
      householdId: m.householdId,
      household: ctx.households.find((h) => h.id === m.householdId)?.name,
      answered: !!m.answers,
      paysFor: a.paysFor.map((p) => `${cat.service.get(p.serviceId)?.name ?? p.serviceId}: ${p.monthly ?? '?'} kr.`),
      wants: a.wants,
      mobile: a.mobile && { provider: a.mobile.providerId ?? a.mobile.other, monthly: a.mobile.monthly, dataNeed: a.dataNeed },
      broadband: a.broadband && { provider: a.broadband.providerId ?? a.broadband.other, monthly: a.broadband.monthly, bindingLeft: a.broadband.bindingLeft },
      tv: a.tv && { provider: a.tv.providerId ?? a.tv.other, monthly: a.tv.monthly },
      willingToSwitch: a.willingToSwitch,
      adsOk: a.adsOk,
      student: a.student,
      keepIds: [
        ...a.paysFor.map((p) => `${KEEP_PREFIX}streaming:${m.id}:${p.serviceId}`),
        ...(a.mobile ? [`${KEEP_PREFIX}mobile:${m.id}`] : []),
        ...(a.broadband ? [`${KEEP_PREFIX}broadband:${m.id}`] : []),
        ...(a.tv ? [`${KEEP_PREFIX}tv:${m.id}`] : []),
      ],
    }
  })
}

const explainSchema = z.object({
  headline: z.string().describe('Én kort sætning på dansk om hvad familien får og sparer.'),
  steps: z.array(z.string()).describe('3–6 korte, konkrete trin på dansk: hvad skal hvem opsige, skifte eller oprette. Brug produktnavne.'),
  caveats: z.array(z.string()).describe('0–3 ting at være opmærksom på (binding, introtilbud der udløber, deling på tværs af hjem).'),
})

export async function explain(ctx: Ctx, packages: BoardPackage[], mode: 'legal' | 'bend') {
  const cat = new Catalog(ctx)
  const r = evaluate(cat, packages)
  const { output } = await generateText({
    model: AI_MODEL,
    providerOptions: aiProviderOptions,
    output: Output.object({ schema: explainSchema }),
    system: `Du forklarer en færdig opsætning af streaming, mobil og internet for en dansk familie. Skriv kort og konkret på dansk, uden emojis.
Brug produkternes og personernes navne, aldrig id'er eller tekniske feltnavne. Skriv ikke beløb; dem viser appen selv.
${mode === 'bend' ? 'Opsætningen deler nogle logins på tværs af hjem. Nævn ærligt hvilke og risikoen.' : 'Opsætningen følger tjenesternes regler.'}`,
    prompt: JSON.stringify({
      family: describeFamily(ctx, cat).map(({ keepIds: _k, ...rest }) => rest),
      households: ctx.households.map((h) => ({ id: h.id, name: h.name })),
      setup: packages.map((p, i) => ({
        name: p.name,
        paidBy: ctx.households.find((h) => h.id === p.householdId)?.name,
        users: p.memberIds.map((m) => ctx.members.find((x) => x.id === m)?.name),
        products: p.productIds.map((id) => {
          const x = cat.priced(id)
          return x ? `${x.providerName} ${x.name}` : id
        }),
        warnings: r.packages[i]?.warnings.map((w) => w.text),
      })),
      notCovered: r.missing.map((m) => `${ctx.members.find((x) => x.id === m.memberId)?.name}: ${cat.service.get(m.serviceId)?.name}`),
    }),
  })
  return output
}
