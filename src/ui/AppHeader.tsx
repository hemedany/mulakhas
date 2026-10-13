import type { Icon } from '@phosphor-icons/react'
import { ClockCounterClockwiseIcon, GearSixIcon, GlobeIcon, QuestionIcon } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import { KhatamMark } from '@/brand/Khatam'
import { BrandBar } from '@/brand/Ornament'
import { useEngine } from '@/app/engine-hooks'
import { useT } from '@/i18n/i18n'

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

export function AppHeader({ onOpen }: { onOpen: (sheet: HeaderSheet) => void }) {
  const t = useT()
  const { prefs } = useEngine()
  // The mark is drawn in on the very first visit, and is still from then on.
  const [drawIn] = useState(() => !prefs.get().markSeen)
  useEffect(() => { if (drawIn) prefs.set({ markSeen: true }) }, [drawIn, prefs])
  return (
    <header>
      <BrandBar className="pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-3 lg:px-6">
          <div className="flex items-center gap-2 ps-1">
            <KhatamMark size={28} className={drawIn ? 'drawn-in' : undefined} />
            <h1 className="font-display text-wordmark font-semibold" translate="no">{t.brand}</h1>
          </div>
          <nav className="flex items-center">
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
