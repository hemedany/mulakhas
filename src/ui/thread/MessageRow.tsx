import { ArrowClockwiseIcon, CaretDownIcon, CaretUpIcon, CheckIcon, PlusIcon, VideoCameraIcon, XIcon } from '@phosphor-icons/react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { formatNumber } from '@/i18n/numbers'
import { KhatamMark } from '@/brand/Khatam'
import { Pattern, StarBadge } from '@/brand/Ornament'
import { useEngine, useOwnKeys, usePrefs } from '@/app/engine-hooks'
import type { HearFailure, MediaMessage, Message, TextMessage, Transcript } from '@/engine'
import { hasSomethingToShow, isSilent } from '@/engine/transcript'
import { useT } from '@/i18n/i18n'
import type { Strings } from '@/i18n/strings'
import { RetryNote } from '../RetryNote'
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
        ? <button type="button" onClick={onConnectKey} className="text-xs font-semibold text-accent transition-transform duration-(--duration-press) ease-snappy motion-safe:active:scale-[0.97]">{t.changeKey}</button>
        : (
          <button type="button" onClick={() => thread.retry(message.id)} className="inline-flex items-center gap-1 text-xs font-semibold text-accent transition-transform duration-(--duration-press) ease-snappy motion-safe:active:scale-[0.97]">
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
    <details className="group mt-1.5">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-xs font-medium text-accent">
        {t.whatItHeard}<CaretDownIcon size={12} weight="bold" className="transition-transform duration-(--duration-ui) ease-snappy group-open:rotate-180" />
      </summary>
      <div className="disclosed mt-1.5 space-y-2 rounded-control bg-sunken px-3 py-2 text-sm text-fg-muted">
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
        {t.watchRejected} <button type="button" onClick={onConnectKey} className="font-semibold text-accent transition-transform duration-(--duration-press) ease-snappy motion-safe:active:scale-[0.97]">{t.changeKey}</button>
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
      {message.retryAt && <RetryNote at={message.retryAt} className="mt-1 text-xs text-fg-muted" />}
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
    <div className="rounded-card rounded-ss-md border border-brand/15 bg-brand-soft px-3.5 pt-2 pb-2.5 transition-colors duration-(--duration-ui) ease-snappy focus-within:border-accent">
      <label className="text-xs text-fg-muted">
        {t.textMessage}
        <textarea ref={ref} rows={1} dir={draft ? 'auto' : undefined} value={draft} placeholder={t.textMessagePlaceholder}
          onChange={e => { setDraft(e.target.value); saveSoon(e.target.value) }}
          onBlur={() => { if (draft !== message.text) save(draft) }}
          className="mt-1 block w-full resize-none bg-transparent text-base [overflow-wrap:anywhere] text-fg placeholder:text-fg-subtle focus:outline-none [field-sizing:content]" />
      </label>
    </div>
  )
}

/** A dashed line between Messages: puts a Text message right there. */
export function InsertHere({ label, onInsert }: { label: string; onInsert: () => void }) {
  const t = useT()
  return (
    <div className="group flex items-center gap-2 py-1.5 ps-[2.625rem] pe-[2.875rem] opacity-70 transition-opacity duration-(--duration-ui) ease-snappy focus-within:opacity-100 hover:opacity-100">
      <span className="h-px flex-1 border-t border-dashed border-line-strong" aria-hidden="true" />
      <button type="button" aria-label={label} title={label} onClick={onInsert}
        className="inline-flex h-7 items-center gap-1 rounded-full border border-line bg-surface px-2.5 text-xs font-medium text-fg-muted transition-[color,border-color,scale] duration-(--duration-press) ease-snappy hover:border-accent hover:text-accent motion-safe:active:scale-[0.95]">
        <PlusIcon size={12} weight="bold" />{t.textHere}
      </button>
      <span className="h-px flex-1 border-t border-dashed border-line-strong" aria-hidden="true" />
    </div>
  )
}

/** One of the two arrows under a Message's number. */
function MoveButton({ label, onMove, children }: { label: string; onMove?: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onMove} disabled={!onMove}
      className="grid h-7 w-8 place-items-center rounded-full text-fg-subtle transition-[color,background-color,scale,opacity] duration-(--duration-press) ease-snappy hover:bg-sunken hover:text-fg disabled:opacity-25 motion-safe:active:scale-[0.9]">
      {children}
    </button>
  )
}

/**
 * One Message in the Thread: the dashed line to put a Text message before it, its position in an
 * eight-pointed star with arrows to move it, the bubble, and a cross to remove it (Undo brings it back).
 */
export function MessageRow({ message, n, isNewText, arrives, leaving, onLeft, onMoveUp, onMoveDown, onRemove, onInsertBefore, onConnectKey }: {
  message: Message
  n: number
  isNewText: boolean
  /** Added since the Thread was opened: it rises into place. */
  arrives: boolean
  /** Being removed: it fades out first. */
  leaving: boolean
  /** Its fade out has ended. */
  onLeft: () => void
  /** Absent at the top (or bottom) of the Thread. */
  onMoveUp?: () => void
  onMoveDown?: () => void
  onRemove: () => void
  onInsertBefore: () => void
  onConnectKey: () => void
}) {
  const t = useT()
  const { uiLang } = usePrefs()
  const number = formatNumber(n, uiLang)
  return (
    <li data-flip={message.id} className={`${arrives ? 'arrives' : ''} ${leaving ? 'leaving' : ''}`}
      onTransitionEnd={e => { if (leaving && e.target === e.currentTarget && e.propertyName === 'opacity') onLeft() }}>
      <InsertHere label={t.addTextBefore(number)} onInsert={onInsertBefore} />
      <div className="flex items-start gap-2.5">
        <div className="flex shrink-0 flex-col items-center">
          <StarBadge n={n} lang={uiLang} className="mt-1.5 mb-0.5" />
          <MoveButton label={t.moveUpN(number)} onMove={onMoveUp}><CaretUpIcon size={16} weight="bold" /></MoveButton>
          <MoveButton label={t.moveDownN(number)} onMove={onMoveDown}><CaretDownIcon size={16} weight="bold" /></MoveButton>
        </div>
        <div className="min-w-0 max-w-[24rem] flex-1 lg:max-w-none">
          {message.kind === 'text' ? <TextBubble message={message} autoFocus={isNewText} /> : <MediaBubble message={message} n={n} onConnectKey={onConnectKey} />}
        </div>
        <button type="button" aria-label={t.removeN(number)} title={t.removeN(number)} onClick={onRemove}
          className="mt-1 grid size-9 shrink-0 place-items-center rounded-full text-fg-subtle transition-[color,background-color,scale] duration-(--duration-press) ease-snappy hover:bg-danger/10 hover:text-danger motion-safe:active:scale-[0.9]">
          <XIcon size={18} weight="bold" />
        </button>
      </div>
    </li>
  )
}
