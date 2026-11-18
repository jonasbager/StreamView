import { ClerkProvider } from '@clerk/nextjs'
import { daDK } from '@clerk/localizations'
import type { Metadata } from 'next'
import { Figtree } from 'next/font/google'
import './globals.css'

const body = Figtree({ variable: '--font-body', subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'StreamView: mere streaming for færre penge',
  description: 'Saml familiens streaming, mobil og internet, og find den billigste kombination.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="da" className={`${body.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <ClerkProvider
          localization={daDK}
          appearance={{
            variables: {
              colorPrimary: '#1d1c1a',
              colorBackground: '#ffffff',
              borderRadius: '12px',
              fontFamily: 'var(--font-body)',
            },
          }}
        >
          {children}
        </ClerkProvider>
      </body>
    </html>
  )
}
