import { ArrowClockwiseIcon } from '@phosphor-icons/react'
import { KhatamProgress } from '@/brand/Khatam'
import { usePrefs, useThread } from '@/app/engine-hooks'
import { useT } from '@/i18n/i18n'
import { formatNumber } from '@/i18n/numbers'
import { RetryNote } from '../RetryNote'
import { needsKey, writeFailureText } from '../write-failures'

/** Where the Result will appear: what Mulakhas is doing now, or why it stopped. */
export function WritingStatus({ onRetry, onConnectKey }: { onRetry: () => void; onConnectKey: () => void }) {
  const t = useT()
  const { uiLang } = usePrefs()
  const { messages, writing } = useThread()
  if (writing.state === 'idle') return null

  if (writing.state === 'failed') {
    const keyProblem = needsKey(writing.failure)
    return (
      <div role="alert" className="mt-5 rounded-card border border-danger/40 bg-surface p-4">
        <p className="text-sm text-danger">{writeFailureText(t)[writing.failure]}</p>
        <button type="button" onClick={keyProblem ? onConnectKey : onRetry}
          className="mt-2 inline-flex h-10 items-center gap-1.5 rounded-full px-1 text-sm font-semibold text-accent transition-transform duration-(--duration-press) ease-snappy active:scale-[0.97]">
          {!keyProblem && <ArrowClockwiseIcon size={16} weight="bold" className="rtl:-scale-x-100" />}
          {keyProblem ? t.changeKey : t.tryAgain}
        </button>
      </div>
    )
  }

  // The star fills one tip per eighth of the Messages heard: honest progress, not a loop.
  const media = messages.filter(m => m.kind !== 'text')
  const done = media.filter(m => m.state === 'heard' || m.state === 'failed').length
  // One tip per Message heard while listening; in parts, one per part written.
  const progress = writing.state === 'writing'
    ? (writing.part ? (writing.part.n - 1) / writing.part.of : 1)
    : media.length ? done / media.length : 1
  const label = writing.state === 'listening'
    ? t.writingListening
    : writing.part
      ? t.writingPart(formatNumber(writing.part.n, uiLang), formatNumber(writing.part.of, uiLang))
      : t.writingNow
  return (
    <div role="status" className="mt-5 flex items-center gap-3 rounded-card border border-ornament/40 bg-surface p-4 shadow-raised">
      <KhatamProgress value={progress} size={36} label={label} />
      <div>
        <p className="font-medium">{label}</p>
        {writing.state === 'writing' && writing.retryAt && <RetryNote at={writing.retryAt} className="text-sm text-fg-muted" />}
      </div>
    </div>
  )
}
