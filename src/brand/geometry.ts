// The eight-pointed star (khatam) shared by the mark, the progress star, badges and rules:
// two squares, one turned 45°. Their union has 16 vertices, alternating between the tips
// (radius R) and the points where the squares' edges cross.

const TAU = Math.PI * 2

/** Radius of the crossing points for tips at radius R. */
export function innerRadius(R: number) {
  return R / (Math.SQRT2 * Math.cos(TAU / 16))
}

/** Vertex i (0..15, even = tip) of a star centred at (cx, cy), first tip pointing up. */
export function starVertex(i: number, cx: number, cy: number, R: number): [number, number] {
  const a = (i * TAU) / 16 - TAU / 4
  const radius = i % 2 ? innerRadius(R) : R
  return [cx + radius * Math.cos(a), cy + radius * Math.sin(a)]
}

export const svgPoints = (pts: [number, number][]) => pts.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ')

/** The full 16-vertex outline, ready for a <polygon points>. */
export function starPoints(cx: number, cy: number, R: number) {
  return svgPoints(Array.from({ length: 16 }, (_, i) => starVertex(i, cx, cy, R)))
}
