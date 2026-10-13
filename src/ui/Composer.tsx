import { useId } from 'react'
import { useEngine, useThread } from '@/app/engine-hooks'
import { PRESETS } from '@/engine/presets'
import { mayWrite } from '@/engine/writer'
import { useT } from '@/i18n/i18n'
import { AddButton, SendButton } from './BarButtons'
import { DictatedTextarea, DictationStatus } from './dictation/DictationField'
import { useDictation } from './dictation/useDictation'
import { FollowUpBox } from './result/FollowUps'

interface ComposerProps {
  onAdd: () => void
  onSummarize: () => void
  busy: boolean
  /** Ask Follow-ups instead of a Request (desktop, once there is a Result). */
  askingFollowUps?: boolean
}

/** The bar docked under the Thread: the Request, or once there is a Result on desktop, a Follow-up. */
export function Composer({ askingFollowUps = false, ...request }: ComposerProps) {
  return (
    <footer className="relative shrink-0 border-t border-ornament/40 bg-surface pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto max-w-2xl px-3 pt-2.5 pb-3 lg:px-0">
        {askingFollowUps ? <FollowUpBox onAdd={request.onAdd} /> : <RequestBar {...request} />}
      </div>
    </footer>
  )
}

/** Mode, presets, the Request itself, and Summarize. What is typed is the Thread's draft, so a reload keeps it. */
function RequestBar({ onAdd, onSummarize, busy }: Omit<ComposerProps, 'askingFollowUps'>) {
  const t = useT()
  const { thread } = useEngine()
  const { draft, messages } = useThread()
  const setDraft = (patch: Partial<typeof draft>) => void thread.setDraft({ ...draft, ...patch })
  const hasSomething = mayWrite(messages)
  const dictation = useDictation(draft.request, request => setDraft({ request }))
  const statusId = useId()
  const go = draft.mode === 'exact' ? t.extractWords : t.summarize

  return (
    <>
      <div className="-mx-3 mb-2.5 flex items-center gap-2 overflow-x-auto px-3 [scrollbar-width:none]">
        <div role="radiogroup" aria-label={t.mode} className="flex shrink-0 rounded-full bg-sunken p-0.5">
          {(['summary', 'exact'] as const).map(m => (
            <button key={m} type="button" role="radio" aria-checked={draft.mode === m} onClick={() => setDraft({ mode: m })}
              className={`h-8 rounded-full px-3 text-sm font-medium transition-colors duration-(--duration-press) ${draft.mode === m ? 'bg-brand text-on-brand' : 'text-fg-muted'}`}>
              {m === 'summary' ? t.modeSummary : t.modeExact}
            </button>
          ))}
        </div>
        {draft.mode === 'summary' && PRESETS.filter(p => p !== 'exact').map(p => (
          <button key={p} type="button" aria-pressed={draft.preset === p} onClick={() => setDraft({ preset: draft.preset === p ? null : p })}
            className={`h-9 shrink-0 rounded-full border px-3.5 text-sm transition-colors duration-(--duration-press) ${draft.preset === p ? 'border-accent bg-accent-soft font-medium text-accent' : 'border-line text-fg-muted'}`}>
            {t.presets[p].label}
          </button>
        ))}
      </div>
      <form className="flex items-end gap-2" onSubmit={e => { e.preventDefault(); if (hasSomething && !busy) onSummarize() }}>
        <AddButton onAdd={onAdd} />
        <DictatedTextarea dictation={dictation} value={draft.request} onChange={request => setDraft({ request })}
          label={t.requestLabel} placeholder={t.requestLabel} statusId={statusId} />
        <SendButton label={go} disabled={!hasSomething || busy || dictation.busy} />
      </form>
      <DictationStatus dictation={dictation} id={statusId} />
    </>
  )
}
