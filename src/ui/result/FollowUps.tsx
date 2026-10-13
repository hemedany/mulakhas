import { ArrowClockwiseIcon, ScissorsIcon } from '@phosphor-icons/react'
import { useEffect, useId, useRef, useState } from 'react'
import { KhatamMark } from '@/brand/Khatam'
import { useEngine } from '@/app/engine-hooks'
import type { FollowUp } from '@/engine'
import { useT } from '@/i18n/i18n'
import { AddButton, SendButton } from '../BarButtons'
import { CopyButton } from '../CopyButton'
import { DictatedTextarea, DictationStatus } from '../dictation/Dictation'
import { useDictation } from '../dictation/useDictation'
import { Markdown } from '../Markdown'
import { scrollBehavior } from '../motion'
import { RetryNote } from '../RetryNote'
import { needsKey, writeFailureText } from '../write-failures'

function Answer({ text, cutOff }: { text: string; cutOff?: boolean }) {
  const t = useT()
  return (
    <div className="text-base">
      <Markdown source={text} titleClass="font-semibold" />
      {cutOff && <p className="mt-2 flex gap-2 text-sm text-caution"><ScissorsIcon size={16} className="mt-0.5 shrink-0" />{t.answerCutOff}</p>}
      <CopyButton text={text} label={t.copyAnswer} iconSize={16}
        className="mt-1 inline-flex h-9 items-center gap-1.5 rounded-full px-2 text-sm font-medium text-accent transition-transform duration-(--duration-press) active:scale-[0.97]" />
    </div>
  )
}

/**
 * The Follow-ups asked about a Result, under it: each question, then its answer (announced when it
 * arrives), or why it failed, with Try again or Change key.
 */
export function FollowUps({ followUps, onConnectKey }: { followUps: FollowUp[]; onConnectKey?: () => void }) {
  const t = useT()
  const { thread } = useEngine()
  const last = useRef<HTMLElement>(null)
  const count = followUps.length
  const lastCount = useRef(count)
  useEffect(() => {
    if (count > lastCount.current) last.current?.scrollIntoView({ block: 'nearest', behavior: scrollBehavior() })
    lastCount.current = count
  }, [count])
  if (!count) return null

  return (
    <section aria-label={t.followUpsTitle} aria-live="polite" className="mt-7 space-y-6 border-t border-ornament/40 pt-6">
      {followUps.map((f, i) => (
        <article key={f.id} ref={i === count - 1 ? last : undefined} className="space-y-2.5">
          <p dir="auto" className="ms-auto w-fit max-w-[85%] rounded-card rounded-se-md bg-brand-soft px-3.5 py-2 text-sm">{f.question}</p>
          {f.state === 'answered' && f.answer && <Answer text={f.answer} cutOff={f.cutOff} />}
          {f.state === 'asking' && (
            <div role="status" className="text-sm text-fg-muted">
              <p className="flex items-center gap-2"><KhatamMark size={18} className="text-ornament" />{t.followUpAnswering}</p>
              {f.retryAt && <RetryNote at={f.retryAt} className="mt-0.5" />}
            </div>
          )}
          {f.state === 'failed' && f.failure && (
            <div role="alert" className="text-sm">
              <p className="text-danger">{writeFailureText(t)[f.failure]}</p>
              {needsKey(f.failure)
                ? <button type="button" onClick={onConnectKey} className="mt-1 h-9 rounded-full px-2 font-semibold text-accent">{t.changeKey}</button>
                : (
                  <button type="button" onClick={() => void thread.retryFollowUp(f.id)} className="mt-1 inline-flex h-9 items-center gap-1.5 rounded-full px-2 font-semibold text-accent">
                    <ArrowClockwiseIcon size={16} weight="bold" className="rtl:-scale-x-100" />{t.tryAgain}
                  </button>
                )}
            </div>
          )}
        </article>
      ))}
    </section>
  )
}

/** Where a Follow-up is typed or dictated: the composer on desktop once there is a Result, the foot of the Result sheet on phones. */
export function FollowUpBox({ onAdd }: { onAdd?: () => void }) {
  const t = useT()
  const { thread } = useEngine()
  const [question, setQuestion] = useState('')
  const dictation = useDictation(question, setQuestion)
  const statusId = useId()
  const ask = () => {
    const q = question.trim()
    if (!q || dictation.state !== 'idle') return
    setQuestion('')
    void thread.askFollowUp(q)
  }
  return (
    <div>
      <form className="flex items-end gap-2" onSubmit={e => { e.preventDefault(); ask() }}>
        {onAdd && <AddButton onAdd={onAdd} />}
        <DictatedTextarea dictation={dictation} value={question} onChange={setQuestion}
          label={t.followUpLabel} placeholder={t.followUpPlaceholder} statusId={statusId} onEnter={ask} />
        <SendButton label={t.askFollowUp} disabled={!question.trim() || dictation.state !== 'idle'} />
      </form>
      <DictationStatus dictation={dictation} id={statusId} />
    </div>
  )
}
