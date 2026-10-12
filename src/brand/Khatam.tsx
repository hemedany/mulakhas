// The khatam (eight-pointed star) is Mulakhas's mark. Geometry: two squares, one turned 45°.
// Their union is a 16-vertex star; the 8 tips double as an honest progress indicator.

const TAU = Math.PI * 2
const R = 11 // tip radius, inside a 24×24 box
const r = R / (Math.SQRT2 * Math.cos(TAU / 16)) // where the two squares' edges cross

function point(i: number, radius: number): [number, number] {
  const a = (i * TAU) / 16 - TAU / 4
  return [12 + radius * Math.cos(a), 12 + radius * Math.sin(a)]
}
const fmt = ([x, y]: [number, number]) => `${x.toFixed(3)},${y.toFixed(3)}`

const STAR = Array.from({ length: 16 }, (_, i) => fmt(point(i, i % 2 ? r : R))).join(' ')
const CORE = Array.from({ length: 8 }, (_, k) => fmt(point(2 * k + 1, r))).join(' ')
const TIPS = Array.from({ length: 8 }, (_, k) =>
  [point(2 * k - 1, r), point(2 * k, R), point(2 * k + 1, r)].map(fmt).join(' '),
)

export function KhatamMark({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true">
      <polygon points={STAR} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="2.4" fill="var(--accent)" />
    </svg>
  )
}

/** The star fills one tip per eighth of progress. `value` is 0..1. */
export function KhatamProgress({ value, size = 20, label }: { value: number; size?: number; label: string }) {
  const filled = Math.round(Math.min(1, Math.max(0, value)) * 8)
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value * 100)}
    >
      <polygon points={CORE} fill="none" stroke="var(--line-strong)" strokeWidth="1.25" strokeLinejoin="round" />
      {TIPS.map((tip, k) => (
        <polygon
          key={k}
          points={tip}
          fill="var(--accent)"
          fillOpacity={k < filled ? 1 : 0}
          stroke={k < filled ? 'var(--accent)' : 'var(--line-strong)'}
          strokeWidth="1.25"
          strokeLinejoin="round"
          style={{ transition: 'fill-opacity 240ms var(--ease-snappy), stroke 240ms var(--ease-snappy)' }}
        />
      ))}
    </svg>
  )
}
