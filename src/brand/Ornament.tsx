// Ornament: the small Arabic geometric pieces the interface is dressed in. All static. The
// pattern tile itself is a mask (--pattern in tokens.css), coloured by the element's background.
import { useId, type CSSProperties, type ReactNode, type Ref } from 'react'
import { formatNumber } from '@/i18n/numbers'
import { ArchFill, ArchRim, BarBackdrop } from './backdrops'
import { starPoints } from './geometry'

const BADGE_STAR = starPoints(16, 16, 15)

/** A Message's position, set inside an eight-pointed star, in the reader's own digits. */
export function StarBadge({ n, lang, className = '' }: { n: number; lang: string; className?: string }) {
  return (
    <span className={`relative grid size-8 shrink-0 place-items-center ${className}`}>
      <svg viewBox="0 0 32 32" className="absolute inset-0 size-full" aria-hidden="true">
        <polygon points={BADGE_STAR} fill="var(--surface)" stroke="var(--ornament)" strokeWidth="1.1" strokeLinejoin="round" />
      </svg>
      <span className="tabular relative text-xs font-semibold text-fg">{formatNumber(n, lang)}</span>
    </span>
  )
}

/** A hairline with a small khatam at its centre. */
export function OrnamentRule({ className = '', ...rest }: { className?: string; 'data-opening'?: string }) {
  return (
    <div className={`flex items-center gap-3 text-ornament ${className}`} aria-hidden="true" {...rest}>
      <span className="h-px flex-1 bg-gradient-to-r from-transparent to-current opacity-60 rtl:bg-gradient-to-l" />
      <svg viewBox="0 0 32 32" className="size-4">
        <polygon points={BADGE_STAR} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        <circle cx="16" cy="16" r="3.5" fill="currentColor" />
      </svg>
      <span className="h-px flex-1 bg-gradient-to-l from-transparent to-current opacity-60 rtl:bg-gradient-to-r" />
    </div>
  )
}

/**
 * The star-and-cross tile as a background layer. The outer layer takes the caller's opacity and
 * fades (masks); the inner one carries the tile mask, so the two never fight over mask-image.
 */
export function Pattern({ className = '', onBrand = false, style }: { className?: string; onBrand?: boolean; style?: CSSProperties }) {
  return (
    <div aria-hidden="true" className={`pointer-events-none absolute inset-0 ${className}`} style={style}>
      <div className={`pattern-tile absolute inset-0 ${onBrand ? 'bg-ornament-on-brand' : 'bg-ornament'}`} />
    </div>
  )
}

/** A burgundy bar dressed with the pattern and closed by a gold hairline: the header and every sheet's title. */
export function BrandBar({ children, className = '', patternClassName = 'opacity-[0.16]' }: { children: ReactNode; className?: string; patternClassName?: string }) {
  return (
    <div className={`on-brand relative shrink-0 overflow-hidden bg-brand text-on-brand ${className}`}>
      <BarBackdrop tile={<Pattern onBrand className={patternClassName} />} />
      <div className="relative">{children}</div>
      <div className="relative h-px bg-ornament/70" />
    </div>
  )
}

// An equilateral pointed arch (the two arcs share the span as radius), the outline of a mihrab.
const ARCH = 'M0,100 L0,46 A60,60 0 0 1 50,0 A60,60 0 0 1 100,46 L100,100 Z'

/** Content framed by a pointed arch, filled with the star pattern. */
export function ArchFrame({ children, className = '', ref, ...rest }: { children: ReactNode; className?: string; ref?: Ref<HTMLDivElement>; 'data-opening'?: string }) {
  const clipId = `arch-${useId().replace(/:/g, '')}`
  return (
    <div ref={ref} className={`relative isolate ${className}`} {...rest}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 -z-10 size-full" aria-hidden="true">
        <defs>
          <clipPath id={clipId} clipPathUnits="objectBoundingBox">
            <path d="M0,1 L0,0.46 A0.6,0.6 0 0 1 0.5,0 A0.6,0.6 0 0 1 1,0.46 L1,1 Z" />
          </clipPath>
        </defs>
        <path d={ARCH} fill="var(--brand-soft)" />
      </svg>
      <div className="absolute inset-0 -z-10" style={{ clipPath: `url(#${clipId})` }} aria-hidden="true">
        {/* The pattern stays at the arch's edges and fades out behind the words. */}
        <ArchFill tile={<Pattern className="opacity-35" style={{ maskImage: 'radial-gradient(ellipse 62% 48% at 50% 64%, transparent 40%, black 100%)' }} />} />
      </div>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 size-full overflow-visible" aria-hidden="true">
        <path d={ARCH} fill="none" stroke="var(--ornament)" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
      </svg>
      <ArchRim />
      {children}
    </div>
  )
}
