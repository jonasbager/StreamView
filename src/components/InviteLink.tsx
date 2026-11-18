'use client'

import { useState } from 'react'

export function InviteLink({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)
  const url = typeof window === 'undefined' ? `/join/${code}` : `${window.location.origin}/join/${code}`
  return (
    <div className="flex items-center gap-2 rounded-full border border-line-2 bg-card py-1 pr-1 pl-4">
      <span className="min-w-0 flex-1 truncate text-sm text-ink-2" suppressHydrationWarning>{url}</span>
      <button
        type="button"
        className="btn-primary btn-sm"
        onClick={async () => {
          const full = `${window.location.origin}/join/${code}`
          try {
            if (navigator.share) await navigator.share({ title: 'Bliv en del af vores familie på StreamView', url: full })
            else await navigator.clipboard.writeText(full)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
          } catch {
            /* share sheet cancelled */
          }
        }}
      >
        {copied ? 'Kopieret' : 'Del link'}
      </button>
    </div>
  )
}
