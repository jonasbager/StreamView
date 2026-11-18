import { SignUp } from '@clerk/nextjs'
import { Logo } from '@/components/ui'

export default function Page() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-16">
      <Logo />
      <SignUp fallbackRedirectUrl="/app" signInUrl="/sign-in" />
    </main>
  )
}
