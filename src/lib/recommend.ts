import 'server-only'
import { generateText, Output } from 'ai'
import { z } from 'zod'
import { AI_MODEL, aiProviderOptions } from './ai'
import type { BoardPackage, Recommendation, RecommendedSetup } from '@/db/schema'
import { answersOf, Catalog, EXTRA_SUFFIX, evaluate, KEEP_PREFIX, optimise, type Ctx } from './engine'
import { ENFORCEMENT_DA } from './format'


const setupSchema = z.object({
  intro: z.string().describe('2–3 sætninger på dansk til familien om det vigtigste.'),
  explained: z
    .array(
      z.object({
        index: z.number().int().describe('Index i computedSuggestions'),
        title: z.string().describe('Kort titel for hele opsætningen'),
        summary: z.string().describe('Én sætning på dansk.'),
        reasoning: z.array(z.string()).describe('2–5 korte punkter: hvad ændrer sig, og hvad familien konkret skal gøre (opsige, skifte, oprette).'),
      }),
    )
    .describe('Forklaring til hvert af de beregnede forslag.'),
  setups: z
    .array(
      z.object({
        title: z.string().describe('Kort titel, fx "Billigst efter reglerne"'),
        kind: z.enum(['legal', 'bend']),
        summary: z.string().describe('Én sætning på dansk.'),
        reasoning: z.array(z.string()).describe('2–5 korte punkter på dansk: hvorfor, og hvad familien skal gøre.'),
        packages: z.array(
          z.object({
            name: z.string(),
            householdId: z.string(),
            productIds: z.array(z.string()),
            memberIds: z.array(z.string()),
          }),
        ),
      }),
    )
    .max(2)
    .describe('Kun alternative opsætninger, der er billigere end de beregnede eller dækker mere. Ellers en tom liste.'),
})

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

function describeCatalog(ctx: Ctx, cat: Catalog) {
  return ctx.products.map((p) => ({
    id: p.id,
    provider: cat.provider.get(p.providerId)?.name,
    name: p.name,
    category: p.category,
    price: p.price,
    intro: p.introPrice != null ? `${p.introPrice} kr. i ${p.introMonths} mdr.` : undefined,
    bindingMonths: p.bindingMonths || undefined,
    includes: p.includes.length ? p.includes.map((i) => `${i.serviceId}×${i.capacity}`).join(', ') : undefined,
    ...p.attributes,
    extraMemberId: p.attributes.extraMember ? `${p.id}${EXTRA_SUFFIX}` : undefined,
    offer: p.offerText ?? undefined,
  }))
}

const ruleSummary = (ctx: Ctx) =>
  ctx.services.map((s) => ({
    serviceId: s.id,
    name: s.name,
    oneHouseholdOnly: s.sharing.householdOnly,
    enforcement: ENFORCEMENT_DA[s.sharing.enforcement],
    capacityType: s.capacityType,
  }))

/** Drop ids the model invented and people/homes that don't exist. */
function clean(ctx: Ctx, cat: Catalog, pkgs: Omit<BoardPackage, 'id'>[]) {
  const memberIds = new Set(ctx.members.map((m) => m.id))
  const homeIds = new Set(ctx.households.map((h) => h.id))
  return pkgs
    .map((p) => ({
      ...p,
      householdId: homeIds.has(p.householdId) ? p.householdId : ctx.households[0].id,
      productIds: p.productIds.filter((id) => cat.priced(id) !== null),
      memberIds: [...new Set(p.memberIds.filter((id) => memberIds.has(id)))],
    }))
    .filter((p) => p.productIds.length > 0)
}

const withIds = (pkgs: Omit<BoardPackage, 'id'>[]): BoardPackage[] => pkgs.map((p) => ({ ...p, id: crypto.randomUUID() }))

function fallback(ctx: Ctx, cat: Catalog): Recommendation {
  const legal = optimise(cat, 'legal')
  const bend = optimise(cat, 'bend', 'high')
  const l = evaluate(cat, legal)
  const b = evaluate(cat, bend)
  const strip = (p: BoardPackage[]) => p.map(({ id: _id, ...rest }) => rest)
  const setups: RecommendedSetup[] = [
    {
      id: crypto.randomUUID(),
      title: 'Billigst efter reglerne',
      kind: 'legal',
      summary: `Familieplaner, pakker og ekstra medlemmer, uden at bryde nogen vilkår.`,
      reasoning: ['Deler kun inden for hvert hjem, eller hvor tjenesten tillader familiedeling.', 'Beholder abonnementer for dem, der ikke vil skifte.'],
      packages: strip(legal),
    },
  ]
  if (b.monthly < l.monthly - 1) {
    setups.push({
      id: crypto.randomUUID(),
      title: 'Den grå zone',
      kind: 'bend',
      summary: `Deler også logins på tværs af hjem for tjenester, der ikke håndhæver det hårdt.`,
      reasoning: ['Er imod vilkårene hos flere tjenester. Se advarslerne ved hver pakke.'],
      packages: strip(bend),
    })
  }
  return { createdAt: new Date().toISOString(), intro: 'Her er de billigste kombinationer, vi kan finde ud fra jeres svar.', setups }
}

export async function recommend(ctx: Ctx): Promise<Recommendation> {
  const cat = new Catalog(ctx)
  const base = fallback(ctx, cat)
  const baseEval = base.setups.map((s) => evaluate(cat, withIds(s.packages)))

  try {
    const { output, response } = await generateText({
      model: AI_MODEL,
      providerOptions: aiProviderOptions,
      output: Output.object({ schema: setupSchema }),
      system: `Du er en dansk rådgiver, der hjælper familier med at betale mindst muligt for streaming, mobil, internet og TV.
Skriv kort, venligt og konkret på dansk. Ingen emojis, ingen overdrivelser.
Du får familiens svar, katalogets produkter (med id), tjenesternes delingsregler og to beregnede forslag.
Forklar hvert beregnet forslag i "explained": hvad ændrer sig for hvem, og hvad de konkret skal gøre.
Er et forslag af kind "bend", så nævn ærligt hvilke tjenester der deles på tværs af hjem og hvor hårdt de håndhæver det.
I "setups" må du kun foreslå alternativer, der er billigere eller dækker mere end de beregnede. "legal" må kun dele en tjeneste på tværs af hjem, hvis oneHouseholdOnly er false eller via et officielt ekstra medlem (extraMemberId).
Brug KUN produkt-id'er fra kataloget eller familiens keepIds. Respektér willingToSwitch "no" ved at bruge personens keepIds.
Hver person med mobil skal have et mobilabonnement, og hvert hjem med internet skal have internet.
Tjek om pakker (bundles), familieplaner, studierabat eller at droppe en tjeneste, ingen har bedt om, kan gøre det billigere.
Priserne regnes efter af systemet, så skriv ikke beløb i dine punkter, men beskriv hvad der gør det billigt.
I al tekst: brug produkternes navne (fx "Netflix Standard med reklamer"), aldrig id'er eller tekniske feltnavne som willingToSwitch, oneHouseholdOnly eller keepIds.
Titlen beskriver hele opsætningen, fx "Billigst efter reglerne" eller "Del TV 2 Play med mormor".`,
      prompt: JSON.stringify({
        family: describeFamily(ctx, cat),
        households: ctx.households.map((h) => ({ id: h.id, name: h.name })),
        sharingRules: ruleSummary(ctx),
        catalog: describeCatalog(ctx, cat),
        computedSuggestions: base.setups.map((s, i) => ({
          index: i,
          kind: s.kind,
          monthly: baseEval[i].monthly,
          savingVsToday: baseEval[i].saving,
          packages: s.packages.map((p) => ({
            ...p,
            products: p.productIds.map((id) => {
              const x = cat.priced(id)
              return x ? `${x.providerName} ${x.name}` : id
            }),
          })),
        })),
      }),
    })

    const gaps = (r: ReturnType<typeof evaluate>) => r.missing.length + r.missingTelco.length
    const computed = { legal: baseEval[0], bend: baseEval[1] ?? baseEval[0] }
    const setups: RecommendedSetup[] = []
    for (const s of output.setups) {
      const pkgs = clean(ctx, cat, s.packages)
      if (!pkgs.length) continue
      const r = evaluate(cat, withIds(pkgs))
      // Never label something "legal" that breaks rules.
      const kind = s.kind === 'legal' && r.maxRisk !== 'none' ? 'bend' : s.kind
      // Quality gate: must cover at least as much as our computed setup, and not cost more.
      const ref = computed[kind]
      if (gaps(r) > gaps(ref) || r.monthly > ref.monthly + 1) continue
      setups.push({ id: crypto.randomUUID(), title: s.title, kind, summary: s.summary, reasoning: s.reasoning, packages: pkgs })
    }
    console.info(`recommend: ${response.modelId}, kept ${setups.length}/${output.setups.length} alternatives`)
    // The computed setups always come first, with the model's explanation when it gave one.
    const explainedComputed = base.setups.map((b, i) => {
      const e = output.explained.find((x) => x.index === i)
      return e ? { ...b, title: e.title, summary: e.summary, reasoning: e.reasoning } : b
    })
    const aiKept = output.explained.length > 0 || setups.length > 0
    setups.unshift(...explainedComputed)
    return { createdAt: new Date().toISOString(), intro: aiKept ? output.intro : base.intro, setups: setups.slice(0, 4) }
  } catch (e) {
    console.error('AI recommendation failed, using computed setups', e)
    return base
  }
}
