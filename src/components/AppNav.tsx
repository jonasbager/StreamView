'use client'

import { UserButton } from '@clerk/nextjs'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Logo } from './ui'

export function AppNav({ admin, familyName }: { admin: boolean; familyName?: string }) {
  const path = usePathname()
  const links = [
    { href: '/app', label: 'Overblik' },
    { href: '/app/builder', label: 'Pakker' },
    { href: '/app/family', label: 'Familie' },
    ...(admin ? [{ href: '/admin', label: 'Priser' }] : []),
  ]
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-5">
        <Logo href="/app" />
        {familyName && <span className="hidden text-sm text-ink-3 md:inline">{familyName}</span>}
        <nav className="ml-auto flex items-center gap-1">
          {links.map((l) => {
            const active = l.href === '/app' ? path === '/app' : path.startsWith(l.href)
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-full px-3.5 py-1.5 text-[15px] transition ${active ? 'bg-ink text-paper' : 'text-ink-2 hover:text-ink'}`}
              >
                {l.label}
              </Link>
            )
          })}
        </nav>
        <UserButton />
      </div>
    </header>
  )
}
