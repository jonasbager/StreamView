import { AppNav } from '@/components/AppNav'
import { isAdmin, myMembership } from '@/lib/data'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [m, admin] = await Promise.all([myMembership(), isAdmin()])
  return (
    <>
      <AppNav admin={admin} familyName={m?.family.name} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8 md:py-10">{children}</main>
    </>
  )
}
