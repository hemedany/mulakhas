// PROTOTYPE (ticket 02): small pieces shared by the variants. Layouts stay per-variant.
import type { Icon } from '@phosphor-icons/react'
import { CheckIcon } from '@phosphor-icons/react'
import type { ButtonHTMLAttributes } from 'react'
import { KhatamProgress } from '@/brand/Khatam'
import { waveform, type SampleCopy, type SampleMessage } from './sample'

export function IconButton({ icon: I, label, className = '', ...rest }: { icon: Icon; label: string } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`grid size-11 place-items-center rounded-full text-fg-muted transition-[background-color,color,transform] duration-150 ease-snappy hover:bg-sunken hover:text-fg active:scale-[0.94] ${className}`}
      {...rest}
    >
      <I size={22} />
    </button>
  )
}

export function Wave({ name, played = 0, bars = 28, className = '' }: { name: string; played?: number; bars?: number; className?: string }) {
  const heights = waveform(name, bars)
  return (
    <span aria-hidden="true" className={`flex h-7 items-center gap-[2px] ${className}`}>
      {heights.map((h, i) => (
        <span
          key={i}
          className={`w-[3px] shrink-0 rounded-full ${i / bars < played ? 'bg-accent' : 'bg-fg-subtle/55'}`}
          style={{ height: `${Math.round(h * 100)}%` }}
        />
      ))}
    </span>
  )
}

export function StateTag({ message, copy }: { message: SampleMessage; copy: SampleCopy }) {
  if (message.kind === 'text') return null
  if (message.state === 'heard')
    return (
      <span className="inline-flex items-center gap-1 text-xs text-fg-muted">
        <CheckIcon size={14} weight="bold" className="text-accent" />
        {copy.states.heard}
      </span>
    )
  if (message.state === 'hearing')
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-accent">
        <KhatamProgress value={message.progress ?? 0} size={16} label={copy.states.hearing} />
        {copy.states.hearing}
      </span>
    )
  return <span className="text-xs text-fg-subtle">{copy.states.waiting}</span>
}
