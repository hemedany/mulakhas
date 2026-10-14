import { ArrowCounterClockwiseIcon } from '@phosphor-icons/react'
import { useEffect, useRef, useState } from 'react'
import type { Removed } from '@/engine'
import { useT } from '@/i18n/i18n'

/** Long enough to notice a slip and take it back. */
const SHOWN_MS = 6000
/** The bar's way out: --duration-press, as in index.css. */
const LEAVE_MS = 150

/**
 * "Message removed · Undo", for a few seconds after a Message is removed, so a cross tapped by
 * mistake costs nothing. It waits while pointed at or focused. Keyed by the Message, so each
 * removal starts it afresh.
 */
export function UndoBar({ removed, onUndo, onGone }: { removed: Removed; onUndo: (removed: Removed) => void; onGone: () => void }) {
  const t = useT()
  const [leaving, setLeaving] = useState(false)
  const [held, setHeld] = useState(false)
  const button = useRef<HTMLButtonElement>(null)

  // Removed from the keyboard, focus would be lost with the row: it lands on Undo instead.
  useEffect(() => { if (document.activeElement === document.body) button.current?.focus() }, [])
  useEffect(() => {
    if (held || leaving) return
    const timer = setTimeout(() => setLeaving(true), SHOWN_MS)
    return () => clearTimeout(timer)
  }, [held, leaving])
  useEffect(() => {
    if (!leaving) return
    const timer = setTimeout(onGone, LEAVE_MS)
    return () => clearTimeout(timer)
  }, [leaving, onGone])

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-3 z-10 flex justify-center px-4">
      <div data-leaving={leaving || undefined}
        onPointerEnter={() => setHeld(true)} onPointerLeave={() => setHeld(false)}
        onFocus={() => setHeld(true)} onBlur={() => setHeld(false)}
        className="undo-bar pointer-events-auto flex h-12 items-center gap-2 rounded-full bg-brand ps-5 pe-1.5 text-sm text-on-brand shadow-floating">
        <span role="status">{t.messageRemoved}</span>
        <button ref={button} type="button" onClick={() => { onUndo(removed); setLeaving(true) }}
          className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 font-semibold text-ornament-on-brand transition-[background-color,scale] duration-(--duration-press) ease-snappy hover:bg-on-brand/10 motion-safe:active:scale-[0.95]">
          <ArrowCounterClockwiseIcon size={16} weight="bold" className="rtl:-scale-x-100" />{t.undo}
        </button>
      </div>
    </div>
  )
}
