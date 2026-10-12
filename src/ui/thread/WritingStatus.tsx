import { ArrowClockwiseIcon } from '@phosphor-icons/react'
import { KhatamProgress } from '@/brand/Khatam'
import { usePrefs, useThread } from '@/app/engine-hooks'
import type { WriteFailure } from '@/engine'
import { useT } from '@/i18n/i18n'
import { formatNumber } from '@/i18n/numbers'
import type { Strings } from '@/i18n/strings'

const failureText = (t: Strings): Record<WriteFailure, string> => ({
  'no-key': t.writeNoKey,
  empty: t.writeEmpty,
  'nothing-heard': t.writeNothingHeard,
  rejected: t.failRejected,
  busy: t.failBusy,
  unreachable: t.failUnreachable,
  'too-big': t.writeTooBig,
  unknown: t.writeUnknown,
})

/** Where the Result will appear: what Mulakhas is doing now, or why it stopped. */
export function WritingStatus({ onRetry, onConnectKey }: { onRetry: () => void; onConnectKey: () => void }) {
  const t = useT()
  const { uiLang } = usePrefs()
  const { messages, writing } = useThread()
  if (writing.state === 'idle') return null

  if (writing.state === 'failed') {
    const keyProblem = writing.failure === 'no-key' || writing.failure === 'rejected'
    return (
      <div role="alert" className="mt-5 rounded-card border border-danger/40 bg-surface p-4">
        <p className="text-sm text-danger">{failureText(t)[writing.failure]}</p>
        <button type="button" onClick={keyProblem ? onConnectKey : onRetry}
          className="mt-2 inline-flex h-10 items-center gap-1.5 rounded-full px-1 text-sm font-semibold text-accent">
          {!keyProblem && <ArrowClockwiseIcon size={16} weight="bold" className="rtl:-scale-x-100" />}
          {keyProblem ? t.changeKey : t.tryAgain}
        </button>
      </div>
    )
  }

  // The star fills one tip per eighth of the Messages heard: honest progress, not a loop.
  const media = messages.filter(m => m.kind !== 'text')
  const done = media.filter(m => m.state === 'heard' || m.state === 'failed').length
  // Writing in parts, it fills again part by part.
  const progress = writing.state === 'writing'
    ? (writing.part ? (writing.part.n - 1) / writing.part.of : 1)
    : media.length ? done / media.length : 1
  const label = writing.state === 'listening'
    ? t.writingListening
    : writing.part
      ? t.writingPart(formatNumber(writing.part.n, uiLang), formatNumber(writing.part.of, uiLang))
      : t.writingNow
  const retryTime = writing.state === 'writing' && writing.retryAt
    ? new Intl.DateTimeFormat(uiLang, { timeStyle: 'short' }).format(writing.retryAt)
    : null
  return (
    <div role="status" className="mt-5 flex items-center gap-3 rounded-card border border-ornament/40 bg-surface p-4 shadow-raised">
      <KhatamProgress value={progress} size={36} label={label} />
      <div>
        <p className="font-medium">{label}</p>
        {retryTime && <p className="text-sm text-fg-muted">{t.retryingAt(retryTime)}</p>}
      </div>
    </div>
  )
}
