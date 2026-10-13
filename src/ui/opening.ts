// Where each piece of the wide first screen starts its opening (index.css, .opening), measured from
// the finished layout so it holds in either direction. The arch starts in the middle of the screen;
// every preset starts behind it, its leading edge at the arch's centre, and fans out to its place:
// the farthest column first, the nearest on top, like cards dealt from under the arch.

const middle = (r: DOMRect) => r.left + r.width / 2

/** The nearest column of presets comes out this much after the farthest. */
const MOST_DELAY_MS = 80

export function placeOpening(screen: HTMLElement, arch: HTMLElement, presets: HTMLElement[], cards: HTMLElement[]) {
  const rtl = getComputedStyle(screen).direction === 'rtl'
  const centre = middle(screen.getBoundingClientRect())
  const archCentre = middle(arch.getBoundingClientRect())
  const leadingEdge = (piece: HTMLElement) => { const r = piece.getBoundingClientRect(); return rtl ? r.right : r.left }
  const away = (card: HTMLElement) => Math.abs(middle(card.getBoundingClientRect()) - archCentre)
  const nearest = Math.min(...cards.map(away))
  const spread = Math.max(...cards.map(away)) - nearest || 1

  arch.style.setProperty('--from', `${centre - archCentre}px`)
  for (const piece of presets) piece.style.setProperty('--from', `${centre - leadingEdge(piece)}px`)
  for (const card of cards) {
    const closeness = 1 - (away(card) - nearest) / spread // 1 for the column beside the arch, 0 for the farthest
    card.style.setProperty('--delay', `${Math.round(closeness * MOST_DELAY_MS)}ms`)
    card.style.setProperty('--stack', `${1 + Math.round(closeness * 2)}`)
  }
}
