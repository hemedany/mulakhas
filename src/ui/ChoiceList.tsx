import { CheckIcon } from '@phosphor-icons/react'

/** A single-choice list for sheets (language, appearance). */
export function ChoiceList<T extends string>({ label, value, options, onChange }: {
  label: string
  value: T
  options: { value: T; label: string; lang?: string }[]
  onChange: (value: T) => void
}) {
  return (
    <div role="radiogroup" aria-label={label} className="divide-y divide-line">
      {options.map(o => {
        const on = o.value === value
        return (
          <button key={o.value} type="button" role="radio" aria-checked={on} lang={o.lang} onClick={() => onChange(o.value)}
            className="flex h-13 w-full items-center justify-between gap-3 text-start transition-opacity duration-(--duration-press) ease-snappy active:opacity-60">
            <span className={on ? 'font-semibold' : ''}>{o.label}</span>
            {on && <CheckIcon size={18} weight="bold" className="text-accent" />}
          </button>
        )
      })}
    </div>
  )
}
