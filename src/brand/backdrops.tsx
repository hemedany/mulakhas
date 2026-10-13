// PROTOTYPE (issue #16): three directions for the background and ornament, chosen with ?bg=
// (rosette | ablaq | stone; anything else is today's star tile). Throwaway: the winner is folded
// into Ornament.tsx and this file goes.
import { useId, type CSSProperties } from 'react'
import { starPoints } from './geometry'

export type Backdrop = 'tile' | 'rosette' | 'ablaq' | 'stone'
const asked = typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('bg')
export const BACKDROP: Backdrop = asked === 'rosette' || asked === 'ablaq' || asked === 'stone' ? asked : 'tile'

const TAU = Math.PI * 2
const f = (n: number) => n.toFixed(2)
const pt = (r: number, a: number): [number, number] => [r * Math.cos(a), r * Math.sin(a)]
const poly = (pts: [number, number][]) => `M${pts.map(([x, y]) => `${f(x)},${f(y)}`).join('L')}Z`
const at = (i: number) => -TAU / 4 + (i * TAU) / 16

const petal = (a: number) => {
  const [ix, iy] = pt(25, a), [ox, oy] = pt(64, a), [lx, ly] = pt(44, a - 0.17), [rx, ry] = pt(44, a + 0.17)
  return `M${f(ix)},${f(iy)}Q${f(lx)},${f(ly)} ${f(ox)},${f(oy)}Q${f(rx)},${f(ry)} ${f(ix)},${f(iy)}Z`
}
/** The medallion, drawn once: a double rim, a sixteen-point star as a band, a ring of petals, the khatam. */
const ROSETTE = [
  poly(Array.from({ length: 32 }, (_, i) => pt(i % 2 ? 74 : 94.5, at(i / 2)))),
  poly(Array.from({ length: 32 }, (_, i) => pt(i % 2 ? 70.5 : 89, at(i / 2)))),
  Array.from({ length: 16 }, (_, i) => petal(at(i))).join(''),
  Array.from({ length: 16 }, (_, i) => poly([pt(57, at(i + 0.5)), pt(62, at(i + 0.42)), pt(67, at(i + 0.5)), pt(62, at(i + 0.58))])).join(''),
].join('')

/** A Damascene medallion in hairlines, like the centre of an 'Ajami ceiling. */
export function Rosette({ className = '', style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg viewBox="-100 -100 200 200" className={className} style={style} aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" vectorEffect="non-scaling-stroke">
        <circle r="98" vectorEffect="non-scaling-stroke" />
        <circle r="94.5" vectorEffect="non-scaling-stroke" />
        <circle r="66" vectorEffect="non-scaling-stroke" />
        <circle r="25" vectorEffect="non-scaling-stroke" />
        <path d={ROSETTE} vectorEffect="non-scaling-stroke" />
        <polygon points={starPoints(0, 0, 19)} vectorEffect="non-scaling-stroke" />
      </g>
      <circle r="4.5" fill="none" stroke="currentColor" strokeWidth="1" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

/** Old plaster: a broad mottle and a fine grain, in the element's colour. */
function Plaster({ grain = 0.5, mottle = 0.6 }: { grain?: number; mottle?: number }) {
  const id = `plaster-${useId().replace(/:/g, '')}`
  return (
    <svg className="absolute inset-0 size-full" aria-hidden="true">
      <filter id={`${id}-m`} x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.006 0.009" numOctaves="3" seed="11" />
        <feColorMatrix values={`0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  ${mottle * 2.2} 0 0 0 ${-mottle * 0.9}`} />
        <feComposite in="SourceGraphic" operator="in" />
      </filter>
      <filter id={`${id}-g`} x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="3" stitchTiles="stitch" />
        <feColorMatrix values={`0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  ${grain * 1.6} 0 0 0 ${-grain * 0.55}`} />
        <feComposite in="SourceGraphic" operator="in" />
      </filter>
      <rect width="100%" height="100%" fill="currentColor" filter={`url(#${id}-m)`} />
      <rect width="100%" height="100%" fill="currentColor" filter={`url(#${id}-g)`} />
    </svg>
  )
}

/** Courses of light and dark stone, as on the walls of Damascus. */
const COURSES: CSSProperties = {
  backgroundImage: 'repeating-linear-gradient(to bottom, transparent 0 5rem, color-mix(in oklab, var(--fg) 3.5%, transparent) 5rem 10rem)',
}

/** The page behind the Thread: outside the scroller, so it stays put. */
export function PageBackdrop({ tile }: { tile: React.ReactNode }) {
  if (BACKDROP === 'rosette') {
    return (
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden text-ornament">
        <Rosette className="absolute end-0 bottom-0 size-[150vmin] translate-x-[38%] translate-y-[38%] opacity-[0.16] rtl:-translate-x-[38%] lg:size-[125vmin] lg:opacity-[0.2]" />
        <Rosette className="absolute start-0 top-0 hidden size-[70vmin] -translate-x-[45%] -translate-y-[45%] opacity-[0.14] rtl:translate-x-[45%] lg:block" />
      </div>
    )
  }
  if (BACKDROP === 'ablaq') {
    return <div aria-hidden="true" className="pointer-events-none absolute inset-0 [mask-image:linear-gradient(to_bottom,black,transparent_75%)] lg:[mask-image:none]" style={COURSES} />
  }
  if (BACKDROP === 'stone') {
    return <div aria-hidden="true" className="pointer-events-none absolute inset-0 text-fg opacity-[0.11] dark:opacity-[0.13]"><Plaster /></div>
  }
  return <>{tile}</>
}

/** What dresses the burgundy bars (the header, every sheet's title). */
export function BarBackdrop({ tile }: { tile: React.ReactNode }) {
  if (BACKDROP === 'rosette') {
    return (
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden text-ornament-on-brand">
        <Rosette className="absolute end-0 top-1/2 size-80 translate-x-[30%] -translate-y-1/2 opacity-[0.3] rtl:-translate-x-[30%]" />
      </div>
    )
  }
  if (BACKDROP === 'ablaq') {
    return <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ backgroundImage: 'repeating-linear-gradient(to bottom, transparent 0 0.875rem, color-mix(in oklab, var(--brand-deep) 70%, transparent) 0.875rem 1.75rem)' }} />
  }
  if (BACKDROP === 'stone') {
    return <div aria-hidden="true" className="pointer-events-none absolute inset-0 text-on-brand opacity-[0.12]"><Plaster mottle={0.4} /></div>
  }
  return <>{tile}</>
}

/** Inside the arch, behind the words. */
export function ArchFill({ tile }: { tile: React.ReactNode }) {
  if (BACKDROP === 'rosette') {
    return (
      <div className="absolute inset-0 hidden text-ornament [mask-image:radial-gradient(ellipse_60%_40%_at_50%_70%,transparent_45%,black_95%)] lg:block">
        <Rosette className="absolute top-[9%] left-1/2 w-[78%] -translate-x-1/2 opacity-60" />
      </div>
    )
  }
  if (BACKDROP === 'ablaq') return null
  if (BACKDROP === 'stone') {
    return (
      <div className="absolute inset-0" style={{ backgroundImage: 'linear-gradient(to bottom, color-mix(in oklab, var(--brand) 20%, transparent), transparent 60%)' }}>
        <div className="absolute inset-0 text-fg opacity-[0.1]"><Plaster mottle={0.3} /></div>
      </div>
    )
  }
  return <>{tile}</>
}

// The arch's outline without its base, for the stones that run around it.
const ARCH_OPEN = 'M0,100 L0,46 A60,60 0 0 1 50,0 A60,60 0 0 1 100,46 L100,100'

/** Around the arch: the striped stones (ablaq), or a carved inner rim (stone). */
export function ArchRim() {
  if (BACKDROP === 'ablaq') {
    return (
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 size-full overflow-visible" aria-hidden="true">
        <path d={ARCH_OPEN} fill="none" stroke="var(--surface)" strokeWidth="18" vectorEffect="non-scaling-stroke" />
        <path d={ARCH_OPEN} fill="none" stroke="var(--brand)" strokeWidth="18" pathLength="100" strokeDasharray="4.5 4.5" vectorEffect="non-scaling-stroke" />
        <path d={ARCH_OPEN} fill="none" stroke="var(--ornament)" strokeWidth="1" vectorEffect="non-scaling-stroke" opacity="0.6" />
      </svg>
    )
  }
  if (BACKDROP === 'stone') {
    return (
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-2.5 size-[calc(100%-1.25rem)] overflow-visible" aria-hidden="true">
        <path d={ARCH_OPEN} fill="none" stroke="var(--ornament)" strokeWidth="1" vectorEffect="non-scaling-stroke" opacity="0.7" />
      </svg>
    )
  }
  return null
}
