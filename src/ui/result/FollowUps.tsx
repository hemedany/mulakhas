import { ArrowClockwiseIcon, ArrowUpIcon, CheckIcon, CopyIcon, PlusIcon } from '@phosphor-icons/react'
import { useEffect, useId, useRef, useState } from 'react'
import { KhatamMark } from '@/brand/Khatam'
import { useEngine, usePrefs } from '@/app/engine-hooks'
import type { FollowUp } from '@/engine'
import { useT } from '@/i18n/i18n'
import { DictatedTextarea, DictationStatus } from '../dictation/Dictation'
import { useDictation } from '../dictation/useDictation'
import { Markdown } from '../Markdown'
import { scrollBehavior } from '../motion'
import { writeFailureText } from '../write-failures'

function Answer({ text }: { text: string }) {
  const t = useT()
  const [copied, setCopied] = useState(false)
  return (
    <div className="text-base">
      <Markdown source={text} titleClass="font-semibold" />
      <button type="button"
        onClick={async () => { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1600) }}
        className="mt-1 inline-flex h-9 items-center gap-1.5 rounded-full px-2 text-sm font-medium text-accent transition-transform duration-(--duration-press) active:scale-[0.97]">
        {copied ? <CheckIcon size={16} weight="bold" /> : <CopyIcon size={16} />}
        <span aria-live="polite">{copied ? t.copied : t.copy}</span>
      </button>
    </div>
  )
}

/**
 * The Follow-ups asked about a Result, under it: each question, then its answer, or why it failed
 * with Try again. `live` for the current Result; History shows answered ones only.
 */
export function FollowUps({ followUps, live = false, onConnectKey }: { followUps: FollowUp[]; live?: boolean; onConnectKey?: () => void }) {
  const t = useT()
  const { uiLang } = usePrefs()
  const { thread } = useEngine()
  const last = useRef<HTMLElement>(null)
  const count = followUps.length
  const shownCount = useRef(count)
  useEffect(() => {
    if (live && count > shownCount.current) last.current?.scrollIntoView({ block: 'nearest', behavior: scrollBehavior() })
    shownCount.current = count
  }, [count, live])
  const shown = live ? followUps : followUps.filter(f => f.state === 'answered')
  if (!shown.length) return null

  return (
    <section aria-label={t.followUpsTitle} className="mt-7 space-y-6 border-t border-ornament/40 pt-6">
      {shown.map((f, i) => (
        <article key={f.id} ref={i === shown.length - 1 ? last : undefined} className="space-y-2.5">
          <p dir="auto" className="ms-auto w-fit max-w-[85%] rounded-card rounded-se-md bg-brand-soft px-3.5 py-2 text-sm">{f.question}</p>
          {f.state === 'answered' && f.answer && <Answer text={f.answer} />}
          {f.state === 'asking' && (
            <div role="status" className="text-sm text-fg-muted">
              <p className="flex items-center gap-2"><KhatamMark size={18} className="text-ornament" />{t.followUpAnswering}</p>
              {f.retryAt && <p className="mt-0.5">{t.retryingAt(new Intl.DateTimeFormat(uiLang, { timeStyle: 'short' }).format(f.retryAt))}</p>}
            </div>
          )}
          {f.state === 'failed' && f.failure && (
            <div role="alert" className="text-sm">
              <p className="text-danger">{writeFailureText(t)[f.failure]}</p>
              {f.failure === 'no-key' || f.failure === 'rejected'
                ? <button type="button" onClick={onConnectKey} className="mt-1 h-9 px-1 font-semibold text-accent">{t.changeKey}</button>
                : (
                  <button type="button" onClick={() => void thread.retryFollowUp(f.id)} className="mt-1 inline-flex h-9 items-center gap-1.5 px-1 font-semibold text-accent">
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

/** Where a Follow-up is typed: the composer on desktop once there is a Result, the foot of the Result sheet on phones. */
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
        {onAdd && (
          <button type="button" aria-label={t.addSheetTitle} title={t.addSheetTitle} onClick={onAdd}
            className="grid size-11 shrink-0 place-items-center rounded-full bg-sunken text-fg transition-transform duration-(--duration-press) active:scale-[0.94]">
            <PlusIcon size={20} />
          </button>
        )}
        <DictatedTextarea dictation={dictation} value={question} onChange={setQuestion}
          label={t.followUpLabel} placeholder={t.followUpPlaceholder} statusId={statusId} onEnter={ask} />
        <button type="submit" aria-label={t.askFollowUp} title={t.askFollowUp} disabled={!question.trim() || dictation.state !== 'idle'}
          className="grid size-11 shrink-0 place-items-center rounded-full bg-accent text-on-accent transition-[transform,opacity] duration-(--duration-press) ease-snappy active:scale-[0.94] disabled:opacity-40">
          <ArrowUpIcon size={20} weight="bold" />
        </button>
      </form>
      <DictationStatus dictation={dictation} id={statusId} />
    </div>
  )
}
