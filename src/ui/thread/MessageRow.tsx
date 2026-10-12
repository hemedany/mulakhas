import { ArrowClockwiseIcon, CheckIcon, DotsThreeVerticalIcon, VideoCameraIcon } from '@phosphor-icons/react'
import { useEffect, useRef, useState } from 'react'
import { formatNumber } from '@/i18n/numbers'
import { KhatamMark } from '@/brand/Khatam'
import { Pattern, StarBadge } from '@/brand/Ornament'
import { useEngine, useOwnKeys, usePrefs } from '@/app/engine-hooks'
import type { HearFailure, MediaMessage, Message, TextMessage, Transcript } from '@/engine'
import { hasSomethingToShow, isSilent } from '@/engine/transcript'
import { useT } from '@/i18n/i18n'
import type { Strings } from '@/i18n/strings'
import { Player } from './Player'
import { formatDuration } from './time'

/** What each way of failing says, and what the person can do about it. */
const FAILURES: Record<HearFailure, { says: (t: Strings) => string; fix: 'try-again' | 'change-key' }> = {
  // A refused key can't be fixed by trying again with the same key.
  rejected: { says: t => t.failRejected, fix: 'change-key' },
  busy: { says: t => t.failBusy, fix: 'try-again' },
  unreachable: { says: t => t.failUnreachable, fix: 'try-again' },
  unsupported: { says: t => t.failUnsupported, fix: 'try-again' },
  undecodable: { says: t => t.failUndecodable, fix: 'try-again' },
  'too-long': { says: t => t.failTooLong, fix: 'try-again' },
  'too-big': { says: t => t.failTooBig, fix: 'try-again' },
  unknown: { says: t => t.failUnknown, fix: 'try-again' },
}

function StateLine({ message, onConnectKey }: { message: MediaMessage; onConnectKey: () => void }) {
  const t = useT()
  const { uiLang } = usePrefs()
  const { thread } = useEngine()
  const { groq } = useOwnKeys()
  switch (message.state) {
    case 'heard':
      return (
        <span className="inline-flex items-center gap-1 text-xs text-fg-muted">
          <CheckIcon size={14} weight="bold" className="text-ornament" />{message.transcript?.heardBy === 'gemini' ? t.stateWatched : t.stateHeard}
        </span>
      )
    case 'hearing':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-fg">
          <KhatamMark size={16} className="text-ornament" />
          {message.parts
            ? t.stateHearingPart(formatNumber(message.parts.heard.length + 1, uiLang), formatNumber(message.parts.of, uiLang))
            : t.stateHearing}
        </span>
      )
    case 'failed':
      return FAILURES[message.failure ?? 'unknown'].fix === 'change-key'
        ? <button type="button" onClick={onConnectKey} className="text-xs font-semibold text-accent">{t.changeKey}</button>
        : (
          <button type="button" onClick={() => thread.retry(message.id)} className="inline-flex items-center gap-1 text-xs font-semibold text-accent">
            <ArrowClockwiseIcon size={14} weight="bold" className="rtl:-scale-x-100" />{t.tryAgain}
          </button>
        )
    case 'waiting':
      return <span className="text-xs text-fg-subtle">{groq ? t.stateWaiting : t.stateNeedsKey}</span>
  }
}

/**
 * The Transcript behind "What it heard", with Unclear passages marked, and for a Video Gemini
 * watched, what it shows. Closed by default.
 */
function WhatItHeard({ transcript }: { transcript: Transcript }) {
  const t = useT()
  return (
    <details className="mt-1.5">
      <summary className="cursor-pointer list-none text-xs font-medium text-accent">{t.whatItHeard}</summary>
      <div className="mt-1.5 space-y-2 rounded-control bg-sunken px-3 py-2 text-sm text-fg-muted">
        {transcript.segments.length > 0 && (
          <p dir="auto">
            {transcript.segments.map((s, i) => (
              <span key={i}>
                {s.unclear ? <mark title={t.unclearMark} className="rounded-sm bg-caution/20 px-0.5 text-fg">{s.text}</mark> : s.text}
                {' '}
              </span>
            ))}
          </p>
        )}
        {transcript.shown && (
          <p dir="auto"><span className="block text-xs font-semibold text-fg">{t.whatItShows}</span>{transcript.shown}</p>
        )}
      </div>
    </details>
  )
}

/** What the person should know about how a heard Message was heard: no speech, or a Video only heard, not watched. */
function HeardNote({ message, onConnectKey }: { message: MediaMessage; onConnectKey: () => void }) {
  const t = useT()
  const { gemini } = useOwnKeys()
  const { transcript, watchFailure } = message
  if (!transcript) return null
  if (watchFailure === 'rejected') {
    return (
      <p className="mt-1 text-xs text-fg-muted">
        {t.watchRejected} <button type="button" onClick={onConnectKey} className="font-semibold text-accent">{t.changeKey}</button>
      </p>
    )
  }
  if (watchFailure) return <p className="mt-1 text-xs text-fg-muted">{t.watchFailed}</p>
  if (transcript.heardBy === 'gemini' || !isSilent(transcript)) return null
  return <p className="mt-1 text-xs text-caution">{message.kind === 'voice' ? t.noSpeech : gemini ? t.noSpeechInVideo : t.noSpeechVideo}</p>
}

function FailureNote({ message, failure }: { message: MediaMessage; failure: HearFailure }) {
  const t = useT()
  const { gemini } = useOwnKeys()
  // A Video whose sound can't be opened may simply have none: Gemini could still watch it.
  const says = failure === 'undecodable' && message.kind === 'video' && !gemini ? t.videoNoSound : FAILURES[failure].says(t)
  return <p role="alert" className="mt-1 text-xs text-danger">{says}</p>
}

function RetryNote({ at }: { at: number }) {
  const t = useT()
  const { uiLang } = usePrefs()
  return <p className="mt-1 text-xs text-fg-muted">{t.retryingAt(new Intl.DateTimeFormat(uiLang, { timeStyle: 'short' }).format(at))}</p>
}

function MediaBubble({ message, n, onConnectKey }: { message: MediaMessage; n: number; onConnectKey: () => void }) {
  return (
    <div className="rounded-card rounded-ss-md border border-line bg-surface px-3 py-2.5 shadow-raised">
      {message.kind === 'voice' ? (
        <Player id={message.id} n={n} knownSeconds={message.transcript?.duration} />
      ) : (
        <div className="relative flex h-24 items-center justify-center gap-2 overflow-hidden rounded-control bg-sunken text-fg-muted">
          <Pattern className="opacity-[0.12]" />
          <VideoCameraIcon size={24} className="relative" />
          {message.transcript && <span className="tabular relative text-sm">{formatDuration(message.transcript.duration)}</span>}
        </div>
      )}
      <div className="mt-1.5 flex items-center justify-between gap-3">
        <span className="truncate text-xs text-fg-subtle" dir="ltr">{message.name}</span>
        <StateLine message={message} onConnectKey={onConnectKey} />
      </div>
      {message.retryAt && <RetryNote at={message.retryAt} />}
      {message.state === 'failed' && message.failure && <FailureNote message={message} failure={message.failure} />}
      {message.state === 'heard' && <HeardNote message={message} onConnectKey={onConnectKey} />}
      {message.state === 'heard' && message.transcript && hasSomethingToShow(message.transcript) && <WhatItHeard transcript={message.transcript} />}
    </div>
  )
}

const SAVE_DELAY_MS = 400

function TextBubble({ message, autoFocus }: { message: TextMessage; autoFocus: boolean }) {
  const t = useT()
  const { thread } = useEngine()
  const [draft, setDraft] = useState(message.text)
  const ref = useRef<HTMLTextAreaElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => { if (autoFocus) ref.current?.focus() }, [autoFocus])
  // Saved while typing, so closing the app mid-sentence loses nothing.
  const save = (text: string) => { if (timer.current) clearTimeout(timer.current); void thread.setText(message.id, text) }
  const saveSoon = (text: string) => { if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(() => save(text), SAVE_DELAY_MS) }
  return (
    <div className="rounded-card rounded-ss-md border border-brand/15 bg-brand-soft px-3.5 pt-2 pb-2.5">
      <label className="text-xs text-fg-muted">
        {t.textMessage}
        <textarea ref={ref} rows={1} dir="auto" value={draft} placeholder={t.textMessagePlaceholder}
          onChange={e => { setDraft(e.target.value); saveSoon(e.target.value) }}
          onBlur={() => { if (draft !== message.text) save(draft) }}
          className="mt-1 block w-full resize-none bg-transparent text-base text-fg placeholder:text-fg-subtle focus:outline-none [field-sizing:content]" />
      </label>
    </div>
  )
}

/** One Message in the Thread: its position in an eight-pointed star, the bubble, and its options. */
export function MessageRow({ message, n, isNewText, onOptions, onConnectKey }: { message: Message; n: number; isNewText: boolean; onOptions: () => void; onConnectKey: () => void }) {
  const t = useT()
  const { uiLang } = usePrefs()
  return (
    <li className="flex items-start gap-2.5">
      <StarBadge n={n} lang={uiLang} className="mt-1.5" />
      <div className="min-w-0 max-w-[24rem] flex-1 lg:max-w-none">
        {message.kind === 'text' ? <TextBubble message={message} autoFocus={isNewText} /> : <MediaBubble message={message} n={n} onConnectKey={onConnectKey} />}
      </div>
      <button type="button" aria-label={t.messageOptionsFor(formatNumber(n, uiLang))} onClick={onOptions}
        className="mt-1 grid size-9 shrink-0 place-items-center rounded-full text-fg-subtle transition-colors duration-(--duration-press) hover:bg-sunken hover:text-fg">
        <DotsThreeVerticalIcon size={20} weight="bold" />
      </button>
    </li>
  )
}
