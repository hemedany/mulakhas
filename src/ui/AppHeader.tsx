import type { Icon } from '@phosphor-icons/react'
import { ClockCounterClockwiseIcon, GearSixIcon, GlobeIcon, PlusIcon, QuestionIcon } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import { KhatamMark } from '@/brand/Khatam'
import { BrandBar } from '@/brand/Ornament'
import { useEngine } from '@/app/engine-hooks'
import { useT } from '@/i18n/i18n'

/** The khatam and the wordmark (the page's heading is a screen-reader one, so this can be a button). */
function Brand({ drawIn, roomy = true }: { drawIn: boolean; roomy?: boolean }) {
  const t = useT()
  return (
    <>
      <KhatamMark size={28} className={drawIn ? 'drawn-in' : undefined} />
      <span aria-hidden="true" className={`font-display text-wordmark font-semibold ${roomy ? '' : 'max-sm:hidden'}`} translate="no">{t.brand}</span>
    </>
  )
}

function HeaderButton({ icon: I, label, onClick }: { icon: Icon; label: string; onClick: () => void }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick}
      className="grid size-11 place-items-center rounded-full text-on-brand/85 transition-[background-color,scale] duration-(--duration-press) ease-snappy hover:bg-on-brand/10 motion-safe:active:scale-[0.94]">
      <I size={22} />
    </button>
  )
}

/** What the header's buttons open. */
export type HeaderSheet = 'history' | 'language' | 'settings' | 'tutorial'

/** `onNew` while there is a Thread: the brand and a New button start over (after asking). */
export function AppHeader({ onOpen, onNew }: { onOpen: (sheet: HeaderSheet) => void; onNew?: () => void }) {
  const t = useT()
  const { prefs } = useEngine()
  // The mark is drawn in on the very first visit, and is still from then on.
  const [drawIn] = useState(() => !prefs.get().markSeen)
  useEffect(() => { if (drawIn) prefs.set({ markSeen: true }) }, [drawIn, prefs])
  return (
    <header>
      <BrandBar className="pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-3 lg:px-6">
          <h1 className="sr-only" translate="no">{t.brand}</h1>
          {onNew ? (
            <button type="button" onClick={onNew} aria-label={t.startOver} title={t.startOver}
              className="-ms-1 flex h-11 items-center gap-2 rounded-full px-2 sm:pe-3 transition-[background-color,scale] duration-(--duration-press) ease-snappy hover:bg-on-brand/10 motion-safe:active:scale-[0.97]">
              {/* On a phone the New button needs the wordmark's room: the khatam stands for it. */}
              <Brand drawIn={drawIn} roomy={false} />
            </button>
          ) : (
            <div className="flex items-center gap-2 ps-1"><Brand drawIn={drawIn} /></div>
          )}
          <nav className="flex items-center">
            {onNew && (
              <button type="button" onClick={onNew} title={t.startOver}
                className="arrives me-1 inline-flex h-9 items-center gap-1 rounded-full bg-on-brand/12 ps-2.5 pe-3 text-sm font-semibold text-on-brand transition-[background-color,scale] duration-(--duration-press) ease-snappy hover:bg-on-brand/20 motion-safe:active:scale-[0.95]">
                <PlusIcon size={16} weight="bold" />{t.newThread}
              </button>
            )}
            <HeaderButton icon={ClockCounterClockwiseIcon} label={t.history} onClick={() => onOpen('history')} />
            <HeaderButton icon={GlobeIcon} label={t.language} onClick={() => onOpen('language')} />
            <HeaderButton icon={GearSixIcon} label={t.settings} onClick={() => onOpen('settings')} />
            <HeaderButton icon={QuestionIcon} label={t.tutorial.help} onClick={() => onOpen('tutorial')} />
          </nav>
        </div>
      </BrandBar>
    </header>
  )
}
