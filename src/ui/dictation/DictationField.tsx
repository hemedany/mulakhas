import { MicrophoneIcon, StopIcon } from '@phosphor-icons/react'
import { KhatamMark } from '@/brand/Khatam'
import { useT } from '@/i18n/i18n'
import type { Strings } from '@/i18n/strings'
import type { DictationProblem } from './sessions'
import type { DictationControl } from './useDictation'

const problemText = (t: Strings): Record<DictationProblem, string> => ({
  denied: t.micDenied,
  'no-mic': t.noMic,
  'no-key': t.dictationNeedsKey,
  failed: t.dictationFailed,
})

/**
 * A text box with a mic in it, for the Request and Follow-ups. While listening the box can't be
 * typed in (what is said is going into it); the mic button stops and keeps what was said, and
 * Escape (in the box or on the button) cancels.
 */
export function DictatedTextarea({ dictation, value, onChange, label, placeholder, statusId, onEnter }: {
  dictation: DictationControl
  value: string
  onChange: (text: string) => void
  label: string
  placeholder: string
  /** The id of the DictationStatus line that describes the box. */
  statusId: string
  /** Enter sends (Shift+Enter still adds a line). */
  onEnter?: () => void
}) {
  const t = useT()
  const cancelOnEscape = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && dictation.busy) {
      e.preventDefault()
      dictation.cancel()
    }
  }
  const buttonLabel = dictation.state === 'listening' ? t.stopDictating : dictation.state === 'writing' ? t.dictationWriting : t.dictate
  return (
    <div className="relative min-w-0 flex-1">
      <label>
        <span className="sr-only">{label}</span>
        <textarea rows={1} dir={value ? 'auto' : undefined} value={value} readOnly={dictation.busy} aria-describedby={statusId} placeholder={placeholder}
          enterKeyHint={onEnter ? 'send' : undefined}
          onChange={e => onChange(e.target.value)}
          onKeyDown={e => {
            cancelOnEscape(e)
            if (onEnter && e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); onEnter() }
          }}
          className="block max-h-36 min-h-11 w-full resize-none rounded-control border border-line bg-sunken py-2.5 ps-4 pe-12 leading-6 placeholder:text-fg-subtle read-only:border-accent focus:border-accent focus:outline-none [field-sizing:content]" />
      </label>
      {/* One button through every state, so keyboard focus stays on it. */}
      <button type="button" aria-label={buttonLabel} title={buttonLabel} aria-disabled={dictation.state === 'writing'}
        onClick={() => { if (dictation.state === 'idle') dictation.start(); else if (dictation.state === 'listening') dictation.stop() }}
        onKeyDown={cancelOnEscape}
        className={`absolute end-1 bottom-1 grid size-9 place-items-center rounded-full transition-[color,background-color,scale] duration-(--duration-press) ease-snappy ${
          dictation.state === 'listening' ? 'bg-accent text-on-accent motion-safe:active:scale-[0.94]' : dictation.state === 'writing' ? 'text-ornament' : 'text-fg-muted hover:text-accent motion-safe:active:scale-[0.94]'
        }`}>
        {dictation.state === 'listening' && <span className="absolute inset-0 rounded-full bg-accent/40 motion-safe:animate-listening" aria-hidden="true" />}
        {dictation.state === 'idle' && <MicrophoneIcon size={20} />}
        {dictation.state === 'listening' && <StopIcon size={14} weight="fill" className="relative" />}
        {dictation.state === 'writing' && <KhatamMark size={20} />}
      </button>
    </div>
  )
}

/** Under the bar: how dictation is going, with Cancel while listening, or why it stopped. */
export function DictationStatus({ dictation, id }: { dictation: DictationControl; id: string }) {
  const t = useT()
  if (dictation.state === 'listening') {
    return (
      <p id={id} role="status" className="mt-1.5 flex items-center gap-2 text-xs text-fg-muted">
        <span className="size-1.5 shrink-0 rounded-full bg-accent motion-safe:animate-listening-dot" aria-hidden="true" />
        {dictation.way === 'live' ? t.dictatingLive : t.dictatingPhrases}
        <button type="button" onClick={dictation.cancel} className="ms-auto h-8 shrink-0 rounded-full px-2.5 font-semibold text-accent transition-transform duration-(--duration-press) ease-snappy motion-safe:active:scale-[0.97]">{t.cancel}</button>
      </p>
    )
  }
  if (dictation.state === 'writing') return <p id={id} role="status" className="mt-1.5 text-xs text-fg-muted">{t.dictationWriting}</p>
  if (dictation.problem) return <p id={id} role="alert" className="mt-1.5 text-xs text-danger">{dictation.problem && problemText(t)[dictation.problem]}</p>
  return <span id={id} hidden />
}
