// Ornament: the small Arabic geometric pieces the interface is dressed in. All static; the
// pattern tile itself lives in tokens.css (--pattern, --pattern-on-brand).
import { useId, type CSSProperties, type ReactNode } from 'react'

const TAU = Math.PI * 2

function starPoints(cx: number, cy: number, R: number) {
  const r = R / (Math.SQRT2 * Math.cos(TAU / 16))
  return Array.from({ length: 16 }, (_, i) => {
    const a = (i * TAU) / 16 - TAU / 4
    const rad = i % 2 ? r : R
    return `${(cx + rad * Math.cos(a)).toFixed(2)},${(cy + rad * Math.sin(a)).toFixed(2)}`
  }).join(' ')
}
const BADGE_STAR = starPoints(16, 16, 15)

/** A Message's position, set inside an eight-pointed star, in the reader's own digits. */
export function StarBadge({ n, lang, className = '' }: { n: number; lang: string; className?: string }) {
  return (
    <span className={`relative grid size-8 shrink-0 place-items-center ${className}`}>
      <svg viewBox="0 0 32 32" className="absolute inset-0 size-full" aria-hidden="true">
        <polygon points={BADGE_STAR} fill="var(--surface)" stroke="var(--ornament)" strokeWidth="1.1" strokeLinejoin="round" />
      </svg>
      <span className="tabular relative text-xs font-semibold text-fg">{new Intl.NumberFormat(lang).format(n)}</span>
    </span>
  )
}

/** A hairline with a small khatam at its centre. */
export function OrnamentRule({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-3 text-ornament ${className}`} aria-hidden="true">
      <span className="h-px flex-1 bg-gradient-to-r from-transparent to-current opacity-60 rtl:bg-gradient-to-l" />
      <svg viewBox="0 0 32 32" className="size-4">
        <polygon points={BADGE_STAR} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        <circle cx="16" cy="16" r="3.5" fill="currentColor" />
      </svg>
      <span className="h-px flex-1 bg-gradient-to-l from-transparent to-current opacity-60 rtl:bg-gradient-to-r" />
    </div>
  )
}

/** The star-and-cross tile as a background layer. `onBrand` uses the variant drawn for burgundy grounds. */
export function Pattern({ className = '', onBrand = false, style }: { className?: string; onBrand?: boolean; style?: CSSProperties }) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 ${className}`}
      style={{ backgroundImage: onBrand ? 'var(--pattern-on-brand)' : 'var(--pattern)', backgroundSize: '56px 56px', ...style }}
    />
  )
}

// An equilateral pointed arch (the two arcs share the span as radius), the outline of a mihrab.
const ARCH = 'M0,100 L0,46 A60,60 0 0 1 50,0 A60,60 0 0 1 100,46 L100,100 Z'

/** Content framed by a pointed arch, filled with the star pattern. */
export function ArchFrame({ children, className = '' }: { children: ReactNode; className?: string }) {
  const clipId = `arch-${useId().replace(/:/g, '')}`
  return (
    <div className={`relative isolate ${className}`}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 -z-10 size-full" aria-hidden="true">
        <defs>
          <clipPath id={clipId} clipPathUnits="objectBoundingBox">
            <path d="M0,1 L0,0.46 A0.6,0.6 0 0 1 0.5,0 A0.6,0.6 0 0 1 1,0.46 L1,1 Z" />
          </clipPath>
        </defs>
        <path d={ARCH} fill="var(--brand-soft)" />
      </svg>
      {/* The pattern stays at the arch's edges and fades out behind the words. */}
      <div className="absolute inset-0 -z-10 opacity-35" style={{ clipPath: `url(#${clipId})`, backgroundImage: 'var(--pattern)', backgroundSize: '56px 56px', maskImage: 'radial-gradient(ellipse 62% 48% at 50% 64%, transparent 40%, black 100%)' }} aria-hidden="true" />
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 size-full overflow-visible" aria-hidden="true">
        <path d={ARCH} fill="none" stroke="var(--ornament)" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
      </svg>
      {children}
    </div>
  )
}
