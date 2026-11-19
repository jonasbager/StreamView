'use client'

import { useEffect, useRef, useState } from 'react'
import { LOGO_PATHS } from '@/lib/logo-paths'

/**
 * A provider or service logo: a crisp vector glyph where we have one,
 * otherwise the provider's own app icon, otherwise its initials.
 */
export function BrandMark({ id, name, color, size = 32 }: { id?: string; name: string; color: string; size?: number }) {
  const [failed, setFailed] = useState(false)
  const img = useRef<HTMLImageElement>(null)
  // An image that failed before hydration never fires onError; check it once mounted.
  useEffect(() => {
    const el = img.current
    if (el && el.complete && el.naturalWidth === 0) setFailed(true)
  }, [])
  const radius = Math.round(size * 0.28)
  const path = id ? LOGO_PATHS[id] : undefined
  if (path) {
    return (
      <span className="grid shrink-0 place-items-center" style={{ width: size, height: size, background: color, borderRadius: radius }} aria-hidden>
        <svg viewBox="0 0 24 24" width={size * 0.56} height={size * 0.56} fill="#fff">
          <path d={path} />
        </svg>
      </span>
    )
  }
  if (id && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        ref={img}
        src={`/api/logo/${id}`}
        alt=""
        width={size}
        height={size}
        onError={() => setFailed(true)}
        className="shrink-0 border border-line bg-white object-contain"
        style={{ width: size, height: size, borderRadius: radius, padding: Math.round(size * 0.08) }}
      />
    )
  }
  const letters = name.replace(/[^A-Za-zÆØÅæøå0-9+ ]/g, '').split(' ').map((w) => w[0]).join('').slice(0, 2)
  return (
    <span
      className="grid shrink-0 place-items-center font-semibold text-white"
      style={{ width: size, height: size, background: color, borderRadius: radius, fontSize: Math.round(size * 0.38) }}
      aria-hidden
    >
      {letters}
    </span>
  )
}
