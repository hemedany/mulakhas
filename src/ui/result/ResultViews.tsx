import { PencilSimpleIcon } from '@phosphor-icons/react'
import { useEffect, useRef } from 'react'
import { KhatamMark } from '@/brand/Khatam'
import { BrandBar } from '@/brand/Ornament'
import type { ThreadResult } from '@/engine'
import { useT } from '@/i18n/i18n'
import { scrollBehavior } from '../motion'
import { FollowUps } from './FollowUps'
import { ResultBody } from './ResultBody'

/** The Result: the main thing once it is written, with its Follow-ups; the Messages fold away above it. */
export function ResultInThread({ result, arrives, onConnectKey, onWriteAgain }: { result: ThreadResult; arrives: boolean; onConnectKey: () => void; onWriteAgain?: () => void }) {
  const t = useT()
  const ref = useRef<HTMLElement>(null)
  // A new Result is the point, and the Messages fold away above it: back to the top, where both show.
  useEffect(() => { ref.current?.closest('main')?.scrollTo({ top: 0, behavior: scrollBehavior() }) }, [result.id])
  return (
    <article ref={ref} aria-label={t.resultHeading} className={`mt-3 scroll-mt-4 overflow-hidden rounded-card border border-ornament/40 bg-surface shadow-raised ${arrives ? 'arrives' : ''}`}>
      <BrandBar patternClassName="opacity-[0.22]">
        <div className="flex h-11 items-center justify-between px-5">
          <span className="flex items-center gap-2 text-sm font-medium"><KhatamMark size={18} className={arrives ? 'turns-once' : undefined} />{t.brand}</span>
          <span className="rounded-full bg-on-brand/10 px-2.5 py-0.5 text-xs">{result.mode === 'exact' ? t.modeExact : t.modeSummary}</span>
        </div>
      </BrandBar>
      <div className="px-5 pt-6 pb-6 lg:px-8 lg:pt-7 lg:pb-7">
        <ResultBody text={result.text} cutOff={result.cutOff} report={result.report} titleClass="font-display text-2xl font-semibold lg:text-3xl" />
        <FollowUps followUps={result.followUps} onConnectKey={onConnectKey} />
      </div>
      {onWriteAgain && (
        <div className="border-t border-ornament/40 px-5 py-3 lg:px-8">
          <button type="button" onClick={onWriteAgain}
            className="inline-flex h-10 items-center gap-1.5 rounded-full px-2 text-sm font-semibold text-accent transition-transform duration-(--duration-press) ease-snappy motion-safe:active:scale-[0.97]">
            <PencilSimpleIcon size={16} />{t.writeNewResult}
          </button>
        </div>
      )}
    </article>
  )
}
