import 'server-only'
import { generateText, Output } from 'ai'
import { z } from 'zod'
import type { BoardPackage } from '@/db/schema'
import { AI_MODEL, aiProviderOptions } from './ai'
import { answersOf, applyMove, Catalog, evaluate, KEEP_PREFIX, suggestionMeta, type Ctx, type Suggestion } from './engine'
import { ENFORCEMENT_RANK } from './rules'

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

const movesSchema = z.object({
  moves: z
    .array(
      z.object({
        title: z.string().describe('Kort, konkret forslag på dansk med navne, fx "Opgradér Jonas\' CBB til 100 GB med TV 2 Play og drop den separate TV 2 Play".'),
        why: z.string().describe('Én sætning: hvorfor det er smart.'),
        householdId: z.string(),
        removeIds: z.array(z.string()).describe('Id\'er fra den nuværende opsætning, der skal fjernes'),
        addIds: z.array(z.string()).describe('Produkt-id\'er fra kataloget, der skal tilføjes'),
        memberIds: z.array(z.string()).describe('Personer der skal bruge det nye (kan være tom)'),
      }),
    )
    .max(6),
})

/**
 * Ask the model for further money-saving moves on the current setup. Every move is
 * applied and priced by the engine; only real improvements are returned.
 */
export async function aiMoves(ctx: Ctx, packages: BoardPackage[], known: string[]): Promise<Suggestion[]> {
  const cat = new Catalog(ctx)
  const before = evaluate(cat, packages)
  const { output } = await generateText({
    model: AI_MODEL,
    providerOptions: aiProviderOptions,
    output: Output.object({ schema: movesSchema }),
    system: `Du er en skarp dansk rådgiver, der finder besparelser i en families abonnementer (streaming, mobil, internet, TV).
Find konkrete træk på den NUVÆRENDE opsætning: opgradér/skift et abonnement, så et andet kan droppes; saml abonnementer i en pakke eller familieplan;
brug mobil- eller internetpakker med inkluderet streaming ("vælg N tjenester"); skift til billigere selskab for dem, der vil skifte.
Respektér willingToSwitch "no". Del ikke logins på tværs af hjem (det håndteres separat). Brug kun id'er fra opsætningen og kataloget.
Gentag ikke forslag, der allerede er kendt. Systemet regner prisen ud, så skriv ikke beløb.`,
    prompt: JSON.stringify({
      family: describeFamily(ctx, cat).map(({ keepIds: _k, ...rest }) => rest),
      households: ctx.households.map((h) => ({ id: h.id, name: h.name })),
      currentSetup: packages.map((p) => ({
        householdId: p.householdId,
        users: p.memberIds.map((m) => ctx.members.find((x) => x.id === m)?.name),
        items: p.productIds.map((id) => {
          const x = cat.priced(id)
          return { id, name: x ? `${x.providerName} ${x.name}` : id, monthly: x?.monthly, category: x?.category }
        }),
      })),
      catalog: ctx.products.filter((p) => p.active).map((p) => ({
        id: p.id, provider: ctx.providers.find((x) => x.id === p.providerId)?.name, name: p.name, category: p.category, price: p.price,
        includes: p.includes.map((i) => i.serviceId), choose: p.attributes.choose, dataGb: p.attributes.dataGb, speedMbit: p.attributes.speedMbit,
        bindingMonths: p.bindingMonths || undefined, ads: p.attributes.ads || undefined,
      })),
      alreadySuggested: known,
    }),
  })
  const out: Suggestion[] = []
  for (const m of output.moves) {
    if (!ctx.households.some((h) => h.id === m.householdId)) continue
    const { board } = applyMove(cat, packages, m)
    const after = evaluate(cat, board)
    const saving = before.monthly - after.monthly
    const gained = suggestionMeta.coverage(before) - suggestionMeta.coverage(after)
    if (gained < 0 || ENFORCEMENT_RANK[after.maxRisk] > ENFORCEMENT_RANK[before.maxRisk]) continue
    if (saving < 5 && gained <= 0) continue
    out.push({ id: `ai-${suggestionMeta.signature(board)}`, group: gained > 0 && saving < 0 ? 'more' : 'save', title: m.title, detail: m.why, saving, gained, risk: after.maxRisk, board })
  }
  return out
}
