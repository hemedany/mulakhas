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
      <div role="alert" className="arrives mt-5 rounded-card border border-danger/40 bg-surface p-4">
        <p className="text-sm text-danger">{writeFailureText(t)[writing.failure]}</p>
        <button type="button" onClick={keyProblem ? onConnectKey : onRetry}
          className="mt-2 inline-flex h-10 items-center gap-1.5 rounded-full px-1 text-sm font-semibold text-accent transition-transform duration-(--duration-press) ease-snappy motion-safe:active:scale-[0.97]">
          {!keyProblem && <ArrowClockwiseIcon size={16} weight="bold" className="rtl:-scale-x-100" />}
          {keyProblem ? t.changeKey : t.tryAgain}
        </button>
      </div>
    )
  }

  // The star fills with real progress and only ever fills: listening fills its first half as the
  // Messages are heard, writing its second half as the parts are written (a single write keeps it at half).
  const media = messages.filter(m => m.kind !== 'text')
  const done = media.filter(m => m.state === 'heard' || m.state === 'failed').length
  const heardShare = media.length ? done / media.length : 1
  const writtenShare = writing.state === 'writing' && writing.part ? (writing.part.n - 1) / writing.part.of : 0
  const progress = writing.state === 'listening' ? heardShare / 2 : 0.5 + writtenShare / 2
  const label = writing.state === 'listening'
    ? t.writingListening
    : writing.part
      ? t.writingPart(formatNumber(writing.part.n, uiLang), formatNumber(writing.part.of, uiLang))
      : t.writingNow
  return (
    <div role="status" className="arrives mt-5 flex items-center gap-3 rounded-card border border-ornament/40 bg-surface p-4 shadow-raised">
      <KhatamProgress value={progress} size={36} label={label} />
      <div>
        <p className="font-medium">{label}</p>
        {writing.state === 'writing' && writing.retryAt && <RetryNote at={writing.retryAt} className="text-sm text-fg-muted" />}
      </div>
    </div>
  )
}
