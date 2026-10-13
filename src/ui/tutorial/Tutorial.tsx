import { useEffect, useRef, useState } from 'react'
import { KhatamMark } from '@/brand/Khatam'
import { usePrefs } from '@/app/engine-hooks'
import { RTL_LANGS } from '@/engine'
import { useT } from '@/i18n/i18n'
import type { Strings } from '@/i18n/strings'
import { formatNumber } from '@/i18n/numbers'
import { canReceiveShares } from '../platform'
import { Sheet } from '../Sheet'
import { Scene } from './scenes'
import { TUTORIAL_STEPS, type TutorialStep } from './steps'

/** How far a finger must travel sideways to turn the page. */
const SWIPE_PX = 40

const bodyOf = (t: Strings, step: TutorialStep) => (step === 'request' ? t.tutorial.request.body(t.modeExact) : t.tutorial[step].body)

/**
 * How Mulakhas works, in four steps (five where WhatsApp can share into it): shown once on the
 * first visit and reopened from Help. A native dialog, so focus stays inside and Escape closes it;
 * swipe on touch, arrow keys on a keyboard, both following the reading direction.
 */
export function Tutorial({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT()
  const { uiLang } = usePrefs()
  const [steps] = useState(() => TUTORIAL_STEPS.filter(step => step !== 'share' || canReceiveShares()))
  const [at, setAt] = useState(0)
  const rtl = RTL_LANGS.has(uiLang)
  const panel = useRef<HTMLDivElement>(null)
  const primary = useRef<HTMLButtonElement>(null)
  const swipe = useRef<{ id: number; x: number } | null>(null)
  const [from, setFrom] = useState<'next' | 'back'>('next')
  const go = (delta: number) => { setFrom(delta > 0 ? 'next' : 'back'); setAt(i => Math.min(steps.length - 1, Math.max(0, i + delta))) }
  const close = () => {
    onClose()
    setAt(0)
  }

  // The latest go and direction, for the keyboard listener added once while open.
  const turn = useRef((forward: boolean) => go(forward ? 1 : -1))
  useEffect(() => { turn.current = forward => go(forward !== rtl ? 1 : -1) })
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return
      if (e.key === 'ArrowRight') turn.current(true)
      if (e.key === 'ArrowLeft') turn.current(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])
  // Back and Skip come and go with the step; if focus was on one that went, it moves to the main button.
  useEffect(() => {
    if (open && !panel.current?.closest('dialog')?.contains(document.activeElement)) primary.current?.focus()
  }, [at, open])

  const step = steps[at]
  const last = at === steps.length - 1
  const counter = t.tutorial.stepOf(formatNumber(at + 1, uiLang), formatNumber(steps.length, uiLang))

  return (
    <Sheet open={open} onClose={close} title={t.tutorial.title} closeLabel={t.close} footer={
      <div className="flex items-center gap-2">
        {!last && (
          <button type="button" onClick={close}
            className="h-11 rounded-full px-3 text-sm font-medium text-fg-muted transition-[scale] duration-(--duration-press) ease-snappy motion-safe:active:scale-[0.97]">{t.tutorial.skip}</button>
        )}
        <div className="flex flex-1 justify-center gap-1.5" aria-hidden="true">
          {steps.map((s, i) => <span key={s} className={`size-1.5 rounded-full transition-colors duration-(--duration-ui) ease-snappy ${i === at ? 'bg-accent' : 'bg-line-strong'}`} />)}
        </div>
        {at > 0 && (
          <button type="button" onClick={() => go(-1)}
            className="h-11 rounded-full border border-line px-4 text-sm font-medium transition-[scale] duration-(--duration-press) ease-snappy motion-safe:active:scale-[0.97]">{t.tutorial.back}</button>
        )}
        <button ref={primary} type="button" onClick={last ? close : () => go(1)}
          className="h-11 rounded-full bg-accent hover:bg-accent-strong px-5 text-sm font-medium text-on-accent transition-[background-color,scale] duration-(--duration-press) ease-snappy motion-safe:active:scale-[0.97]">
          {last ? t.tutorial.start : t.tutorial.next}
        </button>
      </div>
    }>
      {/* Swipes are for touch only: a mouse dragging across text is selecting it. */}
      <div ref={panel} className="touch-pan-y"
        onPointerDown={e => {
          if (e.pointerType !== 'touch') return
          swipe.current = { id: e.pointerId, x: e.clientX }
          try {
            e.currentTarget.setPointerCapture(e.pointerId) // the swipe ends here even if the finger leaves the panel
          } catch {
            // A pointer the browser no longer counts as active: the swipe still works without capture.
          }
        }}
        onPointerCancel={() => { swipe.current = null }}
        onPointerUp={e => {
          const from = swipe.current
          swipe.current = null
          if (!from || from.id !== e.pointerId) return
          const dx = e.clientX - from.x
          // Swiping towards where the reading starts brings the next step.
          if (Math.abs(dx) >= SWIPE_PX) go((dx < 0) !== rtl ? 1 : -1)
        }}>
        <div key={step} className="step-in" data-from={from} aria-live="polite">
          <p className="sr-only">{counter}</p>
          <Scene step={step} />
          <h3 className="mt-5 flex items-center gap-2 font-display text-xl font-semibold text-balance">
            <KhatamMark size={18} className="shrink-0 text-ornament" />{t.tutorial[step].title}
          </h3>
          <p className="mt-1.5 text-fg-muted text-pretty">{bodyOf(t, step)}</p>
        </div>
      </div>
    </Sheet>
  )
}
