// Rows that change place glide there instead of jumping: each is measured just before the change
// (`measure`), and once the new order is on screen it starts from where it was and moves to where
// it is. Moving across the screen, so the glide curve (--ease-glide) over --duration-sheet; with
// less motion, rows simply take their new places.
import { useLayoutEffect, useRef, type RefObject } from 'react'

/** A measure older than this belongs to a change that never came (a move at the end of the list). */
const STALE_MS = 1000

const token = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim()
const ms = (value: string) => (value.endsWith('ms') ? parseFloat(value) : parseFloat(value) * 1000) || 0

/** The children of `list` that carry `data-flip`, by that key, as offsets from the list's top. */
function places(list: HTMLElement) {
  const top = list.getBoundingClientRect().top
  const out = new Map<string, number>()
  for (const child of list.children) {
    const key = (child as HTMLElement).dataset.flip
    if (key) out.set(key, child.getBoundingClientRect().top - top)
  }
  return out
}

/** `order` changes whenever the rows do (their keys joined). */
export function useFlip(list: RefObject<HTMLElement | null>, order: string) {
  const before = useRef<{ at: number; places: Map<string, number> } | null>(null)

  useLayoutEffect(() => {
    const was = before.current
    before.current = null
    const el = list.current
    if (!was || !el || performance.now() - was.at > STALE_MS) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const now = places(el)
    const timing = { duration: ms(token('--duration-sheet')), easing: token('--ease-glide') || 'ease-in-out' }
    for (const child of el.children) {
      const key = (child as HTMLElement).dataset.flip
      const from = key ? was.places.get(key) : undefined
      const to = key ? now.get(key) : undefined
      if (from === undefined || to === undefined || Math.abs(from - to) < 1) continue
      child.animate([{ transform: `translateY(${from - to}px)` }, { transform: 'none' }], timing)
    }
  }, [list, order])

  return {
    /** Call just before changing the order. */
    measure() {
      if (list.current) before.current = { at: performance.now(), places: places(list.current) }
    },
  }
}
