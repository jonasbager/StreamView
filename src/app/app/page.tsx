import Link from 'next/link'
import { InviteLink } from '@/components/InviteLink'
import { DEFAULT_SETTINGS } from '@/db/schema'
import { requireFamily } from '@/lib/data'
import { Catalog, todayBoard } from '@/lib/engine'
import { Builder } from './builder/Builder'

export default async function SetupPage() {
  const { me, family, members, ctx } = await requireFamily()
  if (!me.answers) {
    return (
      <div className="mx-auto max-w-lg py-10 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Velkommen, {me.name}</h1>
        <p className="mt-3 text-ink-2">
          Fire korte spørgsmål: hvad du har i dag, hvad du gerne vil have, dine mobil- og internetregninger, og om du vil skifte.
        </p>
        <Link href="/app/onboarding" className="btn-brand mt-8">Kom i gang</Link>
      </div>
    )
  }
  const today = todayBoard(new Catalog(ctx))
  const waiting = members.filter((m) => !m.answers)
  return (
    <div className="space-y-6">
      {waiting.length > 0 && (
        <section className="card flex flex-col gap-4 p-5 md:flex-row md:items-center">
          <div className="flex-1">
            <div className="font-semibold">Mangler svar fra {waiting.map((m) => m.name).join(', ')}</div>
            <div className="text-sm text-ink-2">Forslagene bliver bedre, når alle har svaret.</div>
          </div>
          <div className="md:w-96">
            <InviteLink code={family.inviteCode} />
          </div>
        </section>
      )}
      <Builder
        ctx={ctx}
        initial={family.board?.packages ?? today}
        today={today}
        settings={{ ...DEFAULT_SETTINGS, ...(family.settings ?? {}) }}
        savedAt={family.board?.updatedAt ?? null}
      />
    </div>
  )
}
