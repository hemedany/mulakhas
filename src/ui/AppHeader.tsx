import type { Icon } from '@phosphor-icons/react'
import { ClockCounterClockwiseIcon, GearSixIcon, GlobeIcon } from '@phosphor-icons/react'
import { KhatamMark } from '@/brand/Khatam'
import { BrandBar } from '@/brand/Ornament'
import { useEffect, useState } from 'react'
import { useEngine } from '@/app/engine-hooks'
import { useT } from '@/i18n/i18n'

function HeaderButton({ icon: I, label, onClick }: { icon: Icon; label: string; onClick: () => void }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick}
      className="grid size-11 place-items-center rounded-full text-on-brand/85 transition-[background-color,transform] duration-(--duration-press) ease-snappy hover:bg-on-brand/10 active:scale-[0.94]">
      <I size={22} />
    </button>
  )
}

export function AppHeader({ onHistory, onLanguage, onSettings }: { onHistory: () => void; onLanguage: () => void; onSettings: () => void }) {
  const t = useT()
  const { prefs } = useEngine()
  // The mark is drawn in on the very first visit, and is still from then on.
  const [drawIn] = useState(() => !prefs.get().markDrawn)
  useEffect(() => { if (drawIn) prefs.set({ markDrawn: true }) }, [drawIn, prefs])
  return (
    <header>
      <BrandBar className="pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-3 lg:px-6">
          <div className="flex items-center gap-2 ps-1">
            <KhatamMark size={28} className={drawIn ? 'drawn-in' : undefined} />
            <span className="font-display text-wordmark font-semibold">{t.brand}</span>
          </div>
          <nav className="flex items-center">
            <HeaderButton icon={ClockCounterClockwiseIcon} label={t.history} onClick={onHistory} />
            <HeaderButton icon={GlobeIcon} label={t.language} onClick={onLanguage} />
            <HeaderButton icon={GearSixIcon} label={t.settings} onClick={onSettings} />
          </nav>
        </div>
      </BrandBar>
    </header>
  )
}
