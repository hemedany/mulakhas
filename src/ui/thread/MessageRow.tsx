import { ArrowClockwiseIcon, CheckIcon, DotsThreeVerticalIcon, VideoCameraIcon } from '@phosphor-icons/react'
import { useEffect, useRef, useState } from 'react'
import { KhatamMark } from '@/brand/Khatam'
import { Pattern, StarBadge } from '@/brand/Ornament'
import { useEngine, useOwnKeys, usePrefs } from '@/app/engine-hooks'
import type { HearFailure, MediaMessage, Message, TextMessage, Transcript } from '@/engine'
import { useT } from '@/i18n/i18n'
import type { Strings } from '@/i18n/strings'
import { Player } from './Player'
import { formatDuration } from './time'

const failureText = (t: Strings): Record<HearFailure, string> => ({
  rejected: t.failRejected,
  busy: t.failBusy,
  unreachable: t.failUnreachable,
  unsupported: t.failUnsupported,
  'too-big': t.failTooBig,
  unknown: t.failUnknown,
})

function StateLine({ message }: { message: MediaMessage }) {
  const t = useT()
  const { thread } = useEngine()
  const { groq } = useOwnKeys()
  if (message.state === 'heard') {
    return <span className="inline-flex items-center gap-1 text-xs text-fg-muted"><CheckIcon size={14} weight="bold" className="text-ornament" />{t.stateHeard}</span>
  }
  if (message.state === 'hearing') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-fg">
        <KhatamMark size={16} className="text-ornament motion-safe:animate-[spin_2.4s_linear_infinite]" />
        {t.stateHearing}
      </span>
    )
  }
  if (message.state === 'failed') {
    return (
      <button type="button" onClick={() => thread.retry(message.id)} className="inline-flex items-center gap-1 text-xs font-semibold text-accent">
        <ArrowClockwiseIcon size={14} weight="bold" className="rtl:-scale-x-100" />{t.tryAgain}
      </button>
    )
  }
  return <span className="text-xs text-fg-subtle">{groq ? t.stateWaiting : t.stateNeedsKey}</span>
}

/** The Transcript behind "What it heard", with Unclear passages marked. Closed by default. */
function WhatItHeard({ transcript }: { transcript: Transcript }) {
  const t = useT()
  return (
    <details className="mt-1.5">
      <summary className="cursor-pointer list-none text-xs font-medium text-accent">{t.whatItHeard}</summary>
      <p dir="auto" className="mt-1.5 rounded-control bg-sunken px-3 py-2 text-sm text-fg-muted">
        {transcript.segments.map((s, i) => (
          <span key={i}>
            {s.unclear ? <mark title={t.unclearMark} className="rounded-[0.3em] bg-caution/20 px-0.5 text-fg">{s.text}</mark> : s.text}
            {' '}
          </span>
        ))}
      </p>
    </details>
  )
}

function MediaBubble({ message, n }: { message: MediaMessage; n: number }) {
  const t = useT()
  const label = `${message.kind === 'video' ? t.video : t.voiceNote} ${n}`
  return (
    <div className="rounded-card rounded-ss-md border border-line bg-surface px-3 py-2.5 shadow-raised">
      {message.kind === 'voice' ? (
        <Player id={message.id} label={label} knownSeconds={message.transcript?.duration} />
      ) : (
        <div className="relative flex h-24 items-center justify-center gap-2 overflow-hidden rounded-control bg-sunken text-fg-muted">
          <Pattern className="opacity-[0.12]" />
          <VideoCameraIcon size={24} className="relative" />
          {message.transcript && <span className="tabular relative text-sm">{formatDuration(message.transcript.duration)}</span>}
        </div>
      )}
      <div className="mt-1.5 flex items-center justify-between gap-3">
        <span className="truncate text-xs text-fg-subtle" dir="ltr">{message.name}</span>
        <StateLine message={message} />
      </div>
      {message.state === 'failed' && message.failure && (
        <p role="alert" className="mt-1 text-xs text-danger">{failureText(t)[message.failure]}</p>
      )}
      {message.state === 'heard' && message.transcript && <WhatItHeard transcript={message.transcript} />}
    </div>
  )
}

function TextBubble({ message, autoFocus }: { message: TextMessage; autoFocus: boolean }) {
  const t = useT()
  const { thread } = useEngine()
  const [draft, setDraft] = useState(message.text)
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => { if (autoFocus) ref.current?.focus() }, [autoFocus])
  return (
    <div className="rounded-card rounded-ss-md border border-brand/15 bg-brand-soft px-3.5 pt-2 pb-2.5">
      <label className="text-xs text-fg-muted">
        {t.textMessage}
        <textarea ref={ref} rows={1} dir="auto" value={draft} placeholder={t.textMessagePlaceholder}
          onChange={e => setDraft(e.target.value)}
          onBlur={() => { if (draft !== message.text) void thread.setText(message.id, draft) }}
          className="mt-1 block w-full resize-none bg-transparent text-base text-fg placeholder:text-fg-subtle focus:outline-none [field-sizing:content]" />
      </label>
    </div>
  )
}

/** One Message in the Thread: its position in an eight-pointed star, the bubble, and its options. */
export function MessageRow({ message, n, focusNew, onOptions }: { message: Message; n: number; focusNew: boolean; onOptions: () => void }) {
  const t = useT()
  const { uiLang } = usePrefs()
  return (
    <li className="flex items-start gap-2.5">
      <StarBadge n={n} lang={uiLang} className="mt-1.5" />
      <div className="min-w-0 max-w-[24rem] flex-1 lg:max-w-none">
        {message.kind === 'text' ? <TextBubble message={message} autoFocus={focusNew} /> : <MediaBubble message={message} n={n} />}
      </div>
      <button type="button" aria-label={`${t.messageOptions} ${n}`} onClick={onOptions}
        className="mt-1 grid size-9 shrink-0 place-items-center rounded-full text-fg-subtle transition-colors hover:bg-sunken hover:text-fg">
        <DotsThreeVerticalIcon size={20} weight="bold" />
      </button>
    </li>
  )
}
