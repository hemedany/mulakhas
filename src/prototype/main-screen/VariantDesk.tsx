// PROTOTYPE (ticket 02), variant B "Desk": document-first. The Thread is a numbered
// tracklist with the Request under it; the Result is a readable page. Side by side on wide
// screens, two tabs on phones.
import {
  ClockCounterClockwiseIcon,
  CopyIcon,
  GlobeIcon,
  MicrophoneIcon,
  PlusIcon,
  QuestionIcon,
  ShareNetworkIcon,
} from '@phosphor-icons/react'
import { useState } from 'react'
import { KhatamMark, KhatamProgress } from '@/brand/Khatam'
import { IconButton, StateTag } from './atoms'
import { KIND_ICON } from './kinds'
import { Markdown } from './Markdown'
import { duration, type SampleCopy, type SampleMessage } from './sample'
import type { VariantProps } from './types'

export const name = 'Desk'

function Track({ m, n, copy }: { m: SampleMessage; n: number; copy: SampleCopy }) {
  const Icon = KIND_ICON[m.kind]
  return (
    <li className="flex items-center gap-3 py-3">
      <span className="tabular w-6 shrink-0 text-sm font-medium text-fg-subtle">{String(n).padStart(2, '0')}</span>
      <Icon size={20} className="shrink-0 text-fg-muted" />
      {m.kind === 'text' ? (
        <p className="min-w-0 flex-1 truncate text-[0.95rem]">“{m.text}”</p>
      ) : (
        <div className="min-w-0 flex-1">
          <p className="text-[0.95rem] font-medium">
            {copy.kind[m.kind]} <span className="tabular font-normal text-fg-muted">{duration(m.seconds)}</span>
          </p>
          <p className="truncate text-xs text-fg-subtle" dir="ltr">{m.name}</p>
        </div>
      )}
      <StateTag message={m} copy={copy} />
    </li>
  )
}

export default function VariantDesk({ copy, thread, state, onSummarize }: VariantProps) {
  const [tab, setTab] = useState<'messages' | 'result'>(state === 'result' ? 'result' : 'messages')
  const [mode, setMode] = useState<'summary' | 'exact'>('summary')
  const [preset, setPreset] = useState<string | null>('recipe')
  const messages = state === 'empty' ? [] : thread
  const heard = messages.filter(m => m.kind === 'text' || m.state === 'heard').length


  const messagesPane = (
    <section aria-label={copy.messages} className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5">
        {messages.length === 0 ? (
          <div className="py-10">
            <p className="text-lg font-semibold">{copy.emptyTitle}</p>
            <p className="mt-1 text-fg-muted">{copy.emptyBody}</p>
          </div>
        ) : (
          <ol className="divide-y divide-line">
            {messages.map((m, i) => <Track key={i} m={m} n={i + 1} copy={copy} />)}
          </ol>
        )}
        <div className="flex flex-wrap gap-x-4 border-t border-line py-2">
          <button type="button" className="inline-flex h-11 items-center gap-1.5 text-sm font-medium text-accent"><PlusIcon size={16} weight="bold" />{copy.addMessages}</button>
          <button type="button" className="inline-flex h-11 items-center gap-1.5 text-sm font-medium text-fg-muted"><PlusIcon size={16} weight="bold" />{copy.addText}</button>
        </div>
      </div>

      <div className="shrink-0 border-t border-line bg-surface px-5 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-between gap-3">
          <label htmlFor="desk-request" className="text-sm font-semibold">{copy.requestLabel}</label>
          <div role="radiogroup" aria-label="Mode" className="flex shrink-0 rounded-control bg-sunken p-0.5 text-xs">
            {(['summary', 'exact'] as const).map(m => (
              <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => setMode(m)}
                className={`h-7 rounded-[0.6rem] px-2.5 font-medium transition-colors duration-150 ${mode === m ? 'bg-surface text-fg shadow-raised' : 'text-fg-muted'}`}>
                {m === 'summary' ? copy.modeSummary : copy.modeExact}
              </button>
            ))}
          </div>
        </div>
        {mode === 'summary' && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {copy.presets.filter(p => p.id !== 'exact').map(p => (
              <button key={p.id} type="button" aria-pressed={preset === p.id} onClick={() => setPreset(preset === p.id ? null : p.id)}
                className={`h-8 rounded-full px-3 text-sm transition-colors duration-150 ${preset === p.id ? 'bg-fg text-bg' : 'bg-sunken text-fg-muted'}`}>
                {p.label}
              </button>
            ))}
          </div>
        )}
        <div className="relative mt-3">
          <textarea id="desk-request" rows={2} placeholder={copy.requestPlaceholder}
            className="block w-full resize-none rounded-control border border-line bg-bg py-2.5 ps-3.5 pe-12 placeholder:text-fg-subtle focus:border-accent focus:outline-none" />
          <span className="absolute end-1 top-1"><IconButton icon={MicrophoneIcon} label="Dictate" /></span>
        </div>
        <button type="button" onClick={onSummarize} disabled={messages.length === 0}
          className="mt-3 h-12 w-full rounded-control bg-accent font-semibold text-on-accent transition-[transform,opacity] duration-150 ease-snappy active:scale-[0.98] disabled:opacity-40">
          {copy.summarize}
        </button>
      </div>
    </section>
  )

  const resultPane = (
    <section aria-label={copy.result} className={`min-h-0 overflow-y-auto overscroll-contain bg-sunken lg:block ${tab === 'result' ? 'block' : 'hidden'}`}>
      {state === 'result' ? (
        <article className="mx-auto my-0 max-w-[68ch] bg-surface px-6 py-8 lg:my-8 lg:rounded-card lg:px-10 lg:py-10 lg:shadow-raised">
          <div className="mb-6 flex items-center justify-between gap-4 border-b border-line pb-4">
            <span className="text-sm text-fg-muted">{copy.messagesCount(messages.length)}</span>
            <div className="flex gap-1">
              <IconButton icon={CopyIcon} label={copy.copy} />
              <IconButton icon={ShareNetworkIcon} label={copy.share} />
            </div>
          </div>
          <div className="text-[1.0625rem]">
            <Markdown source={copy.resultMd} titleClass="text-2xl font-semibold tracking-tight" />
          </div>
          <footer className="mt-8 border-t border-line pt-4">
            <h3 className="text-sm font-semibold">{copy.reliability}</h3>
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              {copy.reliabilityRows.map(r => (
                <div key={r.n} className="contents">
                  <dt className="tabular text-fg">{r.clarity}%</dt>
                  <dd className="text-fg-muted">{String(r.n).padStart(2, '0')} · {r.note}</dd>
                </div>
              ))}
            </dl>
            <label className="relative mt-6 block">
              <span className="sr-only">{copy.followUp}</span>
              <input placeholder={copy.followUp} className="h-12 w-full rounded-control border border-line bg-bg ps-3.5 pe-24 placeholder:text-fg-subtle focus:border-accent focus:outline-none" />
              <button type="button" className="absolute end-1.5 top-1.5 h-9 rounded-[0.6rem] bg-fg px-4 text-sm font-medium text-bg">{copy.ask}</button>
            </label>
          </footer>
        </article>
      ) : (
        <div className="grid h-full min-h-[40dvh] place-items-center p-8 text-center">
          <div>
            {messages.length > 0 ? (
              <>
                <div className="mx-auto w-fit"><KhatamProgress value={heard / messages.length} size={44} label={copy.writing} /></div>
                <p className="mt-4 font-medium">{copy.writing}</p>
                <p className="tabular mt-1 text-sm text-fg-muted">{heard} / {messages.length}</p>
              </>
            ) : (
              <KhatamMark size={44} className="mx-auto text-line-strong" />
            )}
          </div>
        </div>
      )}
    </section>
  )

  return (
    <div className="flex h-full flex-col bg-bg">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-line px-3 pt-[env(safe-area-inset-top)]">
        <div className="flex items-center gap-2 ps-2">
          <KhatamMark size={24} className="text-fg" />
          <span className="font-semibold tracking-tight">{copy.appName}</span>
        </div>
        <nav className="flex items-center">
          <IconButton icon={ClockCounterClockwiseIcon} label={copy.history} />
          <IconButton icon={GlobeIcon} label={copy.language} />
          <IconButton icon={QuestionIcon} label={copy.help} />
        </nav>
      </header>
      <div role="tablist" className="grid shrink-0 grid-cols-2 border-b border-line lg:hidden">
        {(['messages', 'result'] as const).map(t => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
            className={`relative h-12 text-sm font-medium transition-colors duration-150 ${tab === t ? 'text-fg' : 'text-fg-subtle'}`}>
            {t === 'messages' ? `${copy.messages} (${messages.length})` : copy.result}
            <span className={`absolute inset-x-6 bottom-0 h-0.5 rounded-full bg-accent transition-opacity duration-150 ${tab === t ? 'opacity-100' : 'opacity-0'}`} />
          </button>
        ))}
      </div>
      <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)] lg:grid-cols-[400px_1fr]">
        <div className={`min-h-0 flex-col lg:flex lg:border-e lg:border-line ${tab === 'messages' ? 'flex' : 'hidden'}`}>{messagesPane}</div>
        {resultPane}
      </div>
    </div>
  )
}
