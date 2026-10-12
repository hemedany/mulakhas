// PROTOTYPE (ticket 02), variant A "Thread": the Thread reads like a chat. Messages are
// bubbles in order; the Request composer is docked at the bottom, within thumb reach; the
// Result arrives as the next item in the Thread and the composer turns into the Follow-up box.
import {
  ArrowUpIcon,
  ClockCounterClockwiseIcon,
  CopyIcon,
  DotsThreeIcon,
  GlobeIcon,
  MicrophoneIcon,
  PlayIcon,
  PlusIcon,
  QuestionIcon,
  ShareNetworkIcon,
  VideoCameraIcon,
} from '@phosphor-icons/react'
import { useEffect, useRef, useState } from 'react'
import { KhatamMark } from '@/brand/Khatam'
import { IconButton, StateTag, Wave } from './atoms'
import { Markdown } from './Markdown'
import { duration, type SampleCopy, type SampleMessage } from './sample'
import type { VariantProps } from './types'

export const name = 'Thread'

function Bubble({ m, n, copy }: { m: SampleMessage; n: number; copy: SampleCopy }) {
  return (
    <li className="group flex items-start gap-2.5">
      <span className="tabular w-5 shrink-0 pt-3 text-end text-xs text-fg-subtle">{n}</span>
      <div className="min-w-0 max-w-[24rem] flex-1">
        {m.kind === 'text' ? (
          <div className="rounded-card rounded-ss-md bg-accent-soft px-3.5 py-2.5 text-fg">
            <p className="text-[0.95rem]">{m.text}</p>
            <p className="mt-0.5 text-xs text-fg-muted">{copy.kind.text}</p>
          </div>
        ) : (
          <div className="rounded-card rounded-ss-md bg-surface px-3 py-2.5 shadow-raised">
            {m.kind === 'voice' ? (
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  aria-label={`${copy.kind.voice} ${n}`}
                  className="grid size-9 shrink-0 place-items-center rounded-full bg-accent-soft text-accent transition-transform duration-150 ease-snappy active:scale-[0.92]"
                >
                  <PlayIcon size={16} weight="fill" />
                </button>
                <Wave name={m.name} className="min-w-0 flex-1 overflow-hidden" />
                <span className="tabular shrink-0 text-xs text-fg-muted">{duration(m.seconds)}</span>
              </div>
            ) : (
              <div className="flex h-24 items-center justify-center gap-2 rounded-control bg-sunken text-fg-subtle">
                <VideoCameraIcon size={24} />
                <span className="tabular text-sm">{duration(m.seconds)}</span>
              </div>
            )}
            <div className="mt-1.5 flex items-center justify-between gap-3">
              <span className="truncate text-xs text-fg-subtle" dir="ltr">{m.name}</span>
              <StateTag message={m} copy={copy} />
            </div>
            {m.state === 'heard' && (
              <details className="group/heard mt-1">
                <summary className="cursor-pointer list-none text-xs font-medium text-accent marker:hidden">{copy.whatItHeard}</summary>
                <p dir="rtl" lang="ar" className="mt-1.5 rounded-control bg-sunken px-3 py-2 text-sm text-fg-muted">{m.heard}</p>
              </details>
            )}
          </div>
        )}
      </div>
      <IconButton icon={DotsThreeIcon} label="More" className="mt-1 size-9 opacity-60 group-hover:opacity-100" />
    </li>
  )
}

export default function VariantThread({ copy, thread, state, onSummarize, onReset }: VariantProps) {
  const [mode, setMode] = useState<'summary' | 'exact'>('summary')
  const [preset, setPreset] = useState<string | null>('recipe')
  const hasResult = state === 'result'
  const messages = state === 'empty' ? [] : thread
  const resultRef = useRef<HTMLElement>(null)
  useEffect(() => { if (hasResult) resultRef.current?.scrollIntoView({ block: 'start' }) }, [hasResult])

  return (
    <div className="flex h-full flex-col bg-bg">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-line px-3 pt-[env(safe-area-inset-top)]">
        <div className="flex items-center gap-2 ps-1">
          <KhatamMark size={26} className="text-fg" />
          <span className="text-lg font-semibold tracking-tight">{copy.appName}</span>
        </div>
        <nav className="flex items-center">
          <IconButton icon={ClockCounterClockwiseIcon} label={copy.history} />
          <IconButton icon={GlobeIcon} label={copy.language} />
          <IconButton icon={QuestionIcon} label={copy.help} />
        </nav>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto max-w-2xl px-3 py-5">
          {messages.length === 0 ? (
            <div className="flex min-h-[55dvh] flex-col items-center justify-center px-6 text-center">
              <KhatamMark size={56} className="text-line-strong" />
              <h1 className="mt-5 text-xl font-semibold text-balance">{copy.emptyTitle}</h1>
              <p className="mt-2 max-w-[34ch] text-fg-muted text-pretty">{copy.emptyBody}</p>
              <button type="button" className="mt-6 inline-flex h-12 items-center gap-2 rounded-full bg-fg px-5 font-medium text-bg transition-transform duration-150 ease-snappy active:scale-[0.97]">
                <PlusIcon size={18} weight="bold" />
                {copy.addMessages}
              </button>
              <button type="button" className="mt-3 h-11 px-3 text-sm font-medium text-accent">{copy.addText}</button>
            </div>
          ) : (
            <ol className="space-y-3">
              {messages.map((m, i) => <Bubble key={i} m={m} n={i + 1} copy={copy} />)}
            </ol>
          )}

          {hasResult && (
            <article ref={resultRef} className="mt-6 scroll-mt-4 rounded-card bg-surface p-5 shadow-raised">
              <div className="mb-4 flex items-center gap-2 text-sm text-fg-muted">
                <KhatamMark size={18} className="text-fg" />
                <span className="font-medium text-fg">{copy.appName}</span>
                <span className="ms-auto rounded-full bg-sunken px-2.5 py-0.5 text-xs">{mode === 'exact' ? copy.modeExact : copy.modeSummary}</span>
              </div>
              <div className="text-base">
                <Markdown source={copy.resultMd} />
              </div>
              <details className="mt-4 rounded-control bg-sunken px-3.5 py-2.5 text-sm">
                <summary className="cursor-pointer font-medium">{copy.reliability}</summary>
                <ul className="mt-2 space-y-1 text-fg-muted">
                  {copy.reliabilityRows.map(r => (
                    <li key={r.n} className="flex gap-3"><span className="tabular w-8 shrink-0 text-fg">{r.clarity}%</span><span>{copy.kind.voice} {r.n}: {r.note}</span></li>
                  ))}
                </ul>
              </details>
              <div className="mt-4 flex gap-2">
                <button type="button" className="inline-flex h-10 items-center gap-1.5 rounded-full border border-line px-4 text-sm font-medium transition-transform duration-150 active:scale-[0.97]"><CopyIcon size={16} />{copy.copy}</button>
                <button type="button" className="inline-flex h-10 items-center gap-1.5 rounded-full border border-line px-4 text-sm font-medium transition-transform duration-150 active:scale-[0.97]"><ShareNetworkIcon size={16} />{copy.share}</button>
              </div>
            </article>
          )}
        </div>
      </main>

      <footer className="shrink-0 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto max-w-2xl px-3 pt-2.5 pb-3">
          {!hasResult && (
            <div className="-mx-3 mb-2.5 flex items-center gap-2 overflow-x-auto px-3 [scrollbar-width:none]">
              <div role="radiogroup" aria-label="Mode" className="flex shrink-0 rounded-full bg-sunken p-0.5">
                {(['summary', 'exact'] as const).map(m => (
                  <button
                    key={m}
                    type="button"
                    role="radio"
                    aria-checked={mode === m}
                    onClick={() => setMode(m)}
                    className={`h-8 rounded-full px-3 text-sm font-medium transition-colors duration-150 ${mode === m ? 'bg-surface text-fg shadow-raised' : 'text-fg-muted'}`}
                  >
                    {m === 'summary' ? copy.modeSummary : copy.modeExact}
                  </button>
                ))}
              </div>
              {mode === 'summary' && copy.presets.filter(p => p.id !== 'exact').map(p => (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={preset === p.id}
                  onClick={() => setPreset(preset === p.id ? null : p.id)}
                  className={`h-9 shrink-0 rounded-full border px-3.5 text-sm transition-colors duration-150 ${preset === p.id ? 'border-accent bg-accent-soft font-medium text-accent' : 'border-line text-fg-muted'}`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}
          <div className="flex items-end gap-2">
            {!hasResult && <IconButton icon={PlusIcon} label={copy.addMessages} className="shrink-0 bg-sunken text-fg" />}
            <label className="relative min-w-0 flex-1">
              <span className="sr-only">{hasResult ? copy.followUp : copy.requestLabel}</span>
              <textarea
                rows={1}
                placeholder={hasResult ? copy.followUp : copy.requestLabel}
                className="block max-h-36 min-h-11 w-full resize-none rounded-[1.375rem] border border-line bg-sunken py-2.5 ps-4 pe-11 leading-6 placeholder:text-fg-subtle focus:border-accent focus:outline-none [field-sizing:content]"
              />
              <span className="absolute end-0.5 bottom-0"><IconButton icon={MicrophoneIcon} label="Dictate" /></span>
            </label>
            <button
              type="button"
              aria-label={hasResult ? copy.ask : copy.summarize}
              title={hasResult ? copy.ask : copy.summarize}
              onClick={hasResult ? undefined : onSummarize}
              disabled={messages.length === 0}
              className="grid size-11 shrink-0 place-items-center rounded-full bg-accent text-on-accent transition-[transform,opacity] duration-150 ease-snappy active:scale-[0.94] disabled:opacity-40"
            >
              <ArrowUpIcon size={20} weight="bold" />
            </button>
          </div>
          {hasResult && (
            <button type="button" onClick={onReset} className="mt-2 h-9 text-sm font-medium text-fg-muted">+ {copy.addMessages}</button>
          )}
        </div>
      </footer>
    </div>
  )
}
