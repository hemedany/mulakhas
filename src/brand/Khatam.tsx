// The khatam (eight-pointed star) is Mulakhas's mark. Its 8 tips double as an honest progress
// indicator. Gold here is ornament, so the centre and the filled tips use --ornament.
import { starPoints, starVertex, svgPoints } from './geometry'

const STAR = starPoints(12, 12, 11)
const CORE = svgPoints(Array.from({ length: 8 }, (_, k) => starVertex(2 * k + 1, 12, 12, 11)))
const TIPS = Array.from({ length: 8 }, (_, k) => svgPoints([starVertex(2 * k - 1, 12, 12, 11), starVertex(2 * k, 12, 12, 11), starVertex(2 * k + 1, 12, 12, 11)]))

export function KhatamMark({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true">
      <polygon points={STAR} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="2.4" fill="var(--ornament)" />
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
          fill="var(--ornament)"
          fillOpacity={k < filled ? 1 : 0}
          stroke={k < filled ? 'var(--ornament)' : 'var(--line-strong)'}
          strokeWidth="1.25"
          strokeLinejoin="round"
          className="transition-[fill-opacity,stroke] duration-(--duration-ui) ease-snappy"
        />
      ))}
    </svg>
  )
}
