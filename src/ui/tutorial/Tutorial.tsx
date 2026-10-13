import { useEffect, useRef, useState } from 'react'
import { KhatamMark } from '@/brand/Khatam'
import { usePrefs } from '@/app/engine-hooks'
import { RTL_LANGS } from '@/engine'
import { useT } from '@/i18n/i18n'
import { formatNumber } from '@/i18n/numbers'
import { Sheet } from '../Sheet'
import { Scene, type TutorialStep } from './scenes'

/**
 * Android is where an installed web app can receive a share from WhatsApp, so only there does the
 * sharing step apply. No browser feature says "can be shared to", so this asks the platform.
 */
const isAndroid = () =>
  (navigator as { userAgentData?: { platform?: string } }).userAgentData?.platform === 'Android' || /Android/i.test(navigator.userAgent)

const STEPS: TutorialStep[] = ['key', 'add', 'share', 'ask', 'result']
/** How far a finger must travel sideways to turn the page. */
const SWIPE_PX = 40

/**
 * How Mulakhas works, in four steps (five on Android): shown once on the first visit and reopened
 * from Help. A native dialog, so focus stays inside and Escape closes it; swipe on touch, arrow
 * keys on a keyboard, both following the reading direction.
 */
export function Tutorial({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT()
  const { uiLang } = usePrefs()
  const [steps] = useState(() => STEPS.filter(step => step !== 'share' || isAndroid()))
  const [at, setAt] = useState(0)
  const rtl = RTL_LANGS.has(uiLang)
  const swipeFrom = useRef<number | null>(null)
  const go = (delta: number) => setAt(i => Math.min(steps.length - 1, Math.max(0, i + delta)))
  const close = () => {
    onClose()
    setAt(0)
  }

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') go(rtl ? -1 : 1)
      if (e.key === 'ArrowLeft') go(rtl ? 1 : -1)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  })

  const step = steps[at]
  const last = at === steps.length - 1
  const body = step === 'ask' ? t.tutorial.ask.body(t.modeExact) : t.tutorial[step].body
  const counter = t.tutorial.stepOf(formatNumber(at + 1, uiLang), formatNumber(steps.length, uiLang))

  return (
    <Sheet open={open} onClose={close} title={t.tutorial.title} closeLabel={t.close} footer={
      <div className="flex items-center gap-2">
        {!last && (
          <button type="button" onClick={close}
            className="h-11 rounded-full px-3 text-sm font-medium text-fg-muted transition-transform duration-(--duration-press) ease-snappy active:scale-[0.97]">{t.tutorial.skip}</button>
        )}
        <div className="flex flex-1 justify-center gap-1.5" aria-hidden="true">
          {steps.map((s, i) => <span key={s} className={`size-1.5 rounded-full transition-colors duration-(--duration-ui) ${i === at ? 'bg-accent' : 'bg-line-strong'}`} />)}
        </div>
        {at > 0 && (
          <button type="button" onClick={() => go(-1)}
            className="h-11 rounded-full border border-line px-4 text-sm font-medium transition-transform duration-(--duration-press) ease-snappy active:scale-[0.97]">{t.tutorial.back}</button>
        )}
        <button type="button" onClick={last ? close : () => go(1)}
          className="h-11 rounded-full bg-accent px-5 text-sm font-medium text-on-accent transition-transform duration-(--duration-press) ease-snappy active:scale-[0.97]">
          {last ? t.tutorial.start : t.tutorial.next}
        </button>
      </div>
    }>
      <div className="touch-pan-y"
        onPointerDown={e => { swipeFrom.current = e.clientX }}
        onPointerUp={e => {
          if (swipeFrom.current === null) return
          const dx = e.clientX - swipeFrom.current
          swipeFrom.current = null
          if (Math.abs(dx) < SWIPE_PX) return
          // Swiping towards where the reading starts brings the next step.
          go((dx < 0) !== rtl ? 1 : -1)
        }}>
        <p className="sr-only" aria-live="polite">{counter}</p>
        <div key={step} className="arrives">
          <Scene step={step} />
          <h3 className="mt-5 flex items-center gap-2 font-display text-xl font-semibold text-balance">
            <KhatamMark size={18} className="shrink-0 text-ornament" />{t.tutorial[step].title}
          </h3>
          <p className="mt-1.5 text-fg-muted text-pretty">{body}</p>
        </div>
      </div>
    </Sheet>
  )
}

/** For someone who used Mulakhas before the makeover: what changed, once, instead of the tutorial. */
export function MakeoverCard({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT()
  return (
    <Sheet open={open} onClose={onClose} title={t.makeover.title} closeLabel={t.close} footer={
      <button type="button" onClick={onClose}
        className="h-12 w-full rounded-full bg-accent px-5 font-medium text-on-accent transition-transform duration-(--duration-press) ease-snappy active:scale-[0.98]">{t.makeover.ok}</button>
    }>
      <ul className="space-y-3">
        {t.makeover.points.map(point => (
          <li key={point} className="flex gap-2.5">
            <KhatamMark size={18} className="mt-0.5 shrink-0 text-ornament" />
            <span className="text-pretty">{point}</span>
          </li>
        ))}
      </ul>
    </Sheet>
  )
}
