// PROTOTYPE (ticket 02), variant D "Damascene": the Owner's pick, combined. Empty state from
// C (arch to add Messages + big intent tiles), Thread from A (chat bubbles, docked composer),
// Result from C (a sheet rising over the Thread). Dressed in the Damascene palette and ornament.
import type { Icon } from '@phosphor-icons/react'
import {
  ArrowUpIcon,
  CheckSquareIcon,
  ClockCounterClockwiseIcon,
  CookingPotIcon,
  CopyIcon,
  GlobeIcon,
  ListBulletsIcon,
  ListNumbersIcon,
  MicrophoneIcon,
  PlayIcon,
  PlusIcon,
  QuestionIcon,
  QuotesIcon,
  ShareNetworkIcon,
  TranslateIcon,
  VideoCameraIcon,
  XIcon,
} from '@phosphor-icons/react'
import { useState } from 'react'
import { KhatamMark } from '@/brand/Khatam'
import { ArchFrame, OrnamentRule, Pattern, StarBadge } from '@/brand/Ornament'
import { StateTag, Wave } from './atoms'
import { Markdown } from './Markdown'
import { duration, type SampleCopy, type SampleMessage } from './sample'
import type { VariantProps } from './types'

export const name = 'Damascene'

const PRESET_ICON: Record<string, Icon> = {
  recipe: CookingPotIcon,
  steps: ListNumbersIcon,
  todo: CheckSquareIcon,
  points: ListBulletsIcon,
  translate: TranslateIcon,
  exact: QuotesIcon,
}

function BrandButton({ icon: I, label }: { icon: Icon; label: string }) {
  return (
    <button type="button" aria-label={label} title={label}
      className="grid size-11 place-items-center rounded-full text-on-brand/85 transition-[background-color,transform] duration-150 ease-snappy hover:bg-white/10 active:scale-[0.94]">
      <I size={22} />
    </button>
  )
}

function Header({ copy }: { copy: SampleCopy }) {
  return (
    <header className="relative shrink-0 overflow-hidden bg-brand pt-[env(safe-area-inset-top)] text-on-brand">
      <Pattern onBrand className="opacity-[0.16]" />
      <div className="relative flex h-14 items-center justify-between px-3">
        <div className="flex items-center gap-2 ps-1">
          <span className="text-on-brand"><KhatamMark size={28} /></span>
          <span className="font-display text-[1.35rem] leading-none font-semibold">{copy.appName}</span>
        </div>
        <nav className="flex items-center">
          <BrandButton icon={ClockCounterClockwiseIcon} label={copy.history} />
          <BrandButton icon={GlobeIcon} label={copy.language} />
          <BrandButton icon={QuestionIcon} label={copy.help} />
        </nav>
      </div>
      <div className="relative h-px bg-ornament/70" />
    </header>
  )
}

function Empty({ copy }: { copy: SampleCopy }) {
  const [picked, setPicked] = useState<string | null>(null)
  return (
    <div className="mx-auto max-w-xl px-4 pt-5 pb-8">
      <ArchFrame className="flex min-h-64 flex-col items-center justify-end px-6 pt-20 pb-6 text-center">
        <span className="text-ornament"><KhatamMark size={44} /></span>
        <h1 className="mt-3 font-display text-xl font-semibold text-balance">{copy.emptyTitle}</h1>
        <p className="mt-1 max-w-[32ch] text-sm text-fg-muted text-pretty">{copy.emptyBody}</p>
        <button type="button" className="mt-4 inline-flex h-12 items-center gap-2 rounded-full bg-accent px-5 font-medium text-on-accent shadow-raised transition-transform duration-150 ease-snappy active:scale-[0.97]">
          <PlusIcon size={18} weight="bold" />
          {copy.addMessages}
        </button>
        <button type="button" className="mt-1.5 h-10 px-3 text-sm font-medium text-fg-muted">{copy.addText}</button>
      </ArchFrame>

      <OrnamentRule className="my-7" />

      <h2 className="font-display text-2xl font-semibold text-balance">{copy.whatDoYouWant}</h2>
      <div className="mt-4 grid grid-cols-2 gap-2.5">
        {copy.presets.map(p => {
          const Icon = PRESET_ICON[p.id]
          const on = picked === p.id
          return (
            <button key={p.id} type="button" aria-pressed={on} onClick={() => setPicked(on ? null : p.id)}
              className={`flex min-h-[6.25rem] flex-col items-start justify-between rounded-card border p-3.5 text-start transition-[transform,border-color,background-color] duration-150 ease-snappy active:scale-[0.97] ${on ? 'border-accent bg-accent-soft' : 'border-line bg-surface'}`}>
              <Icon size={26} className={on ? 'text-accent' : 'text-ornament'} />
              <span>
                <span className="block font-semibold">{p.label}</span>
                <span className="block text-sm text-fg-muted">{p.hint}</span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function Bubble({ m, n, copy, lang }: { m: SampleMessage; n: number; copy: SampleCopy; lang: string }) {
  return (
    <li className="flex items-start gap-2.5">
      <StarBadge n={n} lang={lang} className="mt-1.5" />
      <div className="min-w-0 max-w-[24rem] flex-1">
        {m.kind === 'text' ? (
          <div className="rounded-card rounded-ss-md border border-brand/15 bg-brand-soft px-3.5 py-2.5">
            <p className="text-[0.95rem]">{m.text}</p>
            <p className="mt-0.5 text-xs text-fg-muted">{copy.kind.text}</p>
          </div>
        ) : (
          <div className="rounded-card rounded-ss-md border border-line bg-surface px-3 py-2.5 shadow-raised">
            {m.kind === 'voice' ? (
              <div className="flex items-center gap-2.5">
                <button type="button" aria-label={`${copy.kind.voice} ${n}`}
                  className="grid size-9 shrink-0 place-items-center rounded-full bg-accent-soft text-accent transition-transform duration-150 ease-snappy active:scale-[0.92]">
                  <PlayIcon size={16} weight="fill" />
                </button>
                <Wave name={m.name} className="min-w-0 flex-1 overflow-hidden" />
                <span className="tabular shrink-0 text-xs text-fg-muted">{duration(m.seconds)}</span>
              </div>
            ) : (
              <div className="relative flex h-24 items-center justify-center gap-2 overflow-hidden rounded-control bg-sunken text-fg-muted">
                <Pattern className="opacity-[0.12]" />
                <VideoCameraIcon size={24} className="relative" />
                <span className="tabular relative text-sm">{duration(m.seconds)}</span>
              </div>
            )}
            <div className="mt-1.5 flex items-center justify-between gap-3">
              <span className="truncate text-xs text-fg-subtle" dir="ltr">{m.name}</span>
              <StateTag message={m} copy={copy} />
            </div>
            {m.state === 'heard' && (
              <details className="mt-1">
                <summary className="cursor-pointer list-none text-xs font-medium text-accent">{copy.whatItHeard}</summary>
                <p dir="rtl" lang="ar" className="mt-1.5 rounded-control bg-sunken px-3 py-2 text-sm text-fg-muted">{m.heard}</p>
              </details>
            )}
          </div>
        )}
      </div>
    </li>
  )
}

function Composer({ copy, onSummarize, disabled }: { copy: SampleCopy; onSummarize: () => void; disabled: boolean }) {
  const [mode, setMode] = useState<'summary' | 'exact'>('summary')
  const [preset, setPreset] = useState<string | null>('recipe')
  return (
    <footer className="relative shrink-0 border-t border-ornament/40 bg-surface pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto max-w-2xl px-3 pt-2.5 pb-3">
        <div className="-mx-3 mb-2.5 flex items-center gap-2 overflow-x-auto px-3 [scrollbar-width:none]">
          <div role="radiogroup" aria-label="Mode" className="flex shrink-0 rounded-full bg-sunken p-0.5">
            {(['summary', 'exact'] as const).map(m => (
              <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => setMode(m)}
                className={`h-8 rounded-full px-3 text-sm font-medium transition-colors duration-150 ${mode === m ? 'bg-brand text-on-brand' : 'text-fg-muted'}`}>
                {m === 'summary' ? copy.modeSummary : copy.modeExact}
              </button>
            ))}
          </div>
          {mode === 'summary' && copy.presets.filter(p => p.id !== 'exact').map(p => (
            <button key={p.id} type="button" aria-pressed={preset === p.id} onClick={() => setPreset(preset === p.id ? null : p.id)}
              className={`h-9 shrink-0 rounded-full border px-3.5 text-sm transition-colors duration-150 ${preset === p.id ? 'border-accent bg-accent-soft font-medium text-accent' : 'border-line text-fg-muted'}`}>
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex items-end gap-2">
          <button type="button" aria-label={copy.addMessages} title={copy.addMessages}
            className="grid size-11 shrink-0 place-items-center rounded-full bg-sunken text-fg transition-transform duration-150 active:scale-[0.94]">
            <PlusIcon size={20} />
          </button>
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">{copy.requestLabel}</span>
            <textarea rows={1} placeholder={copy.requestLabel}
              className="block max-h-36 min-h-11 w-full resize-none rounded-[1.375rem] border border-line bg-sunken py-2.5 ps-4 pe-11 leading-6 placeholder:text-fg-subtle focus:border-accent focus:outline-none [field-sizing:content]" />
            <span className="absolute end-0.5 bottom-0">
              <button type="button" aria-label="Dictate" className="grid size-11 place-items-center rounded-full text-fg-muted"><MicrophoneIcon size={22} /></button>
            </span>
          </label>
          <button type="button" aria-label={copy.summarize} title={copy.summarize} onClick={onSummarize} disabled={disabled}
            className="grid size-11 shrink-0 place-items-center rounded-full bg-accent text-on-accent transition-[transform,opacity] duration-150 ease-snappy active:scale-[0.94] disabled:opacity-40">
            <ArrowUpIcon size={20} weight="bold" />
          </button>
        </div>
      </div>
    </footer>
  )
}

function ResultSheet({ copy, onClose }: { copy: SampleCopy; onClose: () => void }) {
  return (
    <div className="absolute inset-0 z-10 flex flex-col justify-end">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-brand-deep/45" />
      <section role="dialog" aria-label={copy.result}
        className="relative mx-auto flex max-h-[90%] w-full max-w-2xl flex-col overflow-hidden rounded-t-sheet bg-surface shadow-floating">
        <div className="relative h-14 shrink-0 overflow-hidden bg-brand text-on-brand">
          <Pattern onBrand className="opacity-[0.22]" />
          <div className="relative mx-auto mt-2 h-1.5 w-10 rounded-full bg-on-brand/40" aria-hidden="true" />
          <div className="relative flex items-center justify-between px-4">
            <span className="flex items-center gap-2 text-sm font-medium"><KhatamMark size={18} />{copy.result}</span>
            <button type="button" aria-label="Close" onClick={onClose} className="-mt-1 grid size-10 place-items-center rounded-full hover:bg-white/10"><XIcon size={20} /></button>
          </div>
        </div>
        <div className="h-px bg-ornament/70" />
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-5 pb-4">
          <Markdown source={copy.resultMd} titleClass="font-display text-[1.75rem] leading-tight font-semibold" />
          <OrnamentRule className="my-6" />
          <h3 className="text-sm font-semibold">{copy.reliability}</h3>
          <ul className="mt-2 space-y-1 text-sm text-fg-muted">
            {copy.reliabilityRows.map(r => (
              <li key={r.n} className="flex gap-3"><span className="tabular w-9 shrink-0 font-medium text-fg">{r.clarity}%</span><span>{copy.kind.voice} {r.n}: {r.note}</span></li>
            ))}
          </ul>
        </div>
        <div className="border-t border-line px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <div className="flex gap-2">
            <button type="button" className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-control bg-accent font-medium text-on-accent transition-transform active:scale-[0.98]"><CopyIcon size={18} />{copy.copy}</button>
            <button type="button" className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-control border border-line font-medium transition-transform active:scale-[0.98]"><ShareNetworkIcon size={18} />{copy.share}</button>
          </div>
          <label className="relative mt-2.5 block">
            <span className="sr-only">{copy.followUp}</span>
            <input placeholder={copy.followUp} className="h-12 w-full rounded-control border border-line bg-sunken ps-3.5 pe-12 placeholder:text-fg-subtle focus:border-accent focus:outline-none" />
            <span className="absolute end-0.5 top-0.5"><button type="button" aria-label="Dictate" className="grid size-11 place-items-center rounded-full text-fg-muted"><MicrophoneIcon size={22} /></button></span>
          </label>
        </div>
      </section>
    </div>
  )
}

export default function VariantDamascene({ copy, thread, state, onSummarize, onReset }: VariantProps) {
  const lang = copy.appName === 'ملخّص' ? 'ar' : 'en'
  const empty = state === 'empty'
  return (
    <div className="relative flex h-full flex-col bg-bg">
      <Header copy={copy} />
      <main className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <Pattern className="ornament-page opacity-[0.07] [mask-image:linear-gradient(to_bottom,black,transparent_70%)]" />
        <div className="relative">
          {empty ? (
            <Empty copy={copy} />
          ) : (
            <ol className="mx-auto max-w-2xl space-y-3 px-3 py-5">
              {thread.map((m, i) => <Bubble key={i} m={m} n={i + 1} copy={copy} lang={lang} />)}
            </ol>
          )}
        </div>
      </main>
      {!empty && <Composer copy={copy} onSummarize={onSummarize} disabled={false} />}
      {state === 'result' && <ResultSheet copy={copy} onClose={onReset} />}
    </div>
  )
}
