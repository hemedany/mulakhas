// PROTOTYPE tooling: floating bar to flip between variants. Dev builds only.
import { CaretLeftIcon, CaretRightIcon } from '@phosphor-icons/react'
import { useEffect } from 'react'

export interface Toggle<T extends string> {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
}

export function PrototypeSwitcher({ variants, current, onChange, toggles }: {
  variants: { key: string; name: string }[]
  current: string
  onChange: (key: string) => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toggles: Toggle<any>[]
}) {
  const i = Math.max(0, variants.findIndex(v => v.key === current))
  const go = (d: number) => onChange(variants[(i + d + variants.length) % variants.length].key)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t.closest('input, textarea, [contenteditable]')) return
      if (e.key === 'ArrowLeft') go(-1)
      if (e.key === 'ArrowRight') go(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const chip = 'h-8 rounded-full px-2.5 text-xs font-medium transition-colors'
  return (
    <div data-prototype-switcher dir="ltr" lang="en" className="shrink-0 border-t border-black/10 bg-[#101214] px-2 py-1.5 pb-[calc(0.375rem+env(safe-area-inset-bottom))] text-white">
      <div className="flex flex-wrap items-center justify-center gap-x-1 gap-y-1.5">
        <span className="me-1 shrink-0 rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-white/60">PROTOTYPE</span>
        <button type="button" aria-label="Previous variant" onClick={() => go(-1)} className="grid size-8 shrink-0 place-items-center rounded-full hover:bg-white/10"><CaretLeftIcon size={16} /></button>
        <span className="min-w-[7.5rem] shrink-0 text-center text-sm font-semibold">{variants[i].key} · {variants[i].name}</span>
        <button type="button" aria-label="Next variant" onClick={() => go(1)} className="grid size-8 shrink-0 place-items-center rounded-full hover:bg-white/10"><CaretRightIcon size={16} /></button>
        {toggles.map(t => (
          <div key={t.label} role="radiogroup" aria-label={t.label} className="ms-1.5 flex shrink-0 rounded-full bg-white/8 p-0.5">
            {t.options.map(o => (
              <button key={o.value} type="button" role="radio" aria-checked={t.value === o.value} onClick={() => t.onChange(o.value)}
                className={`${chip} ${t.value === o.value ? 'bg-white text-[#101214]' : 'text-white/70 hover:text-white'}`}>
                {o.label}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
