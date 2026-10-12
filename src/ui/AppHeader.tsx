import type { Icon } from '@phosphor-icons/react'
import { ClockCounterClockwiseIcon, GearSixIcon, GlobeIcon } from '@phosphor-icons/react'
import { KhatamMark } from '@/brand/Khatam'
import { Pattern } from '@/brand/Ornament'
import { useT } from '@/i18n/i18n'

function HeaderButton({ icon: I, label, onClick }: { icon: Icon; label: string; onClick: () => void }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick}
      className="grid size-11 place-items-center rounded-full text-on-brand/85 transition-[background-color,transform] duration-150 ease-snappy hover:bg-white/10 active:scale-[0.94]">
      <I size={22} />
    </button>
  )
}

export function AppHeader({ onHistory, onLanguage, onSettings }: { onHistory: () => void; onLanguage: () => void; onSettings: () => void }) {
  const t = useT()
  return (
    <header className="relative shrink-0 overflow-hidden bg-brand pt-[env(safe-area-inset-top)] text-on-brand">
      <Pattern onBrand className="opacity-[0.16]" />
      <div className="relative mx-auto flex h-14 max-w-6xl items-center justify-between px-3 lg:px-6">
        <div className="flex items-center gap-2 ps-1">
          <KhatamMark size={28} />
          <span className="font-display text-[1.35rem] leading-none font-semibold">{t.brand}</span>
        </div>
        <nav className="flex items-center">
          <HeaderButton icon={ClockCounterClockwiseIcon} label={t.history} onClick={onHistory} />
          <HeaderButton icon={GlobeIcon} label={t.language} onClick={onLanguage} />
          <HeaderButton icon={GearSixIcon} label={t.settings} onClick={onSettings} />
        </nav>
      </div>
      <div className="relative h-px bg-ornament/70" />
    </header>
  )
}
