import { CaretRightIcon } from '@phosphor-icons/react'
import { useEffect, useRef } from 'react'
import { KhatamMark } from '@/brand/Khatam'
import { BrandBar } from '@/brand/Ornament'
import type { ThreadResult } from '@/engine'
import { titleOf } from '@/engine/writer'
import { useT } from '@/i18n/i18n'
import { scrollBehavior } from '../motion'
import { Sheet } from '../Sheet'
import { FollowUpBox, FollowUps } from './FollowUps'
import { ResultBody } from './ResultBody'

/** Desktop: the Result is the next item in the Thread. */
export function ResultInThread({ result, onConnectKey }: { result: ThreadResult; onConnectKey: () => void }) {
  const t = useT()
  const ref = useRef<HTMLElement>(null)
  useEffect(() => { ref.current?.scrollIntoView({ block: 'start', behavior: scrollBehavior() }) }, [result.id])
  return (
    <article ref={ref} aria-label={t.resultHeading} className="mt-6 scroll-mt-6 overflow-hidden rounded-card border border-ornament/40 bg-surface shadow-raised">
      <BrandBar patternClassName="opacity-[0.22]">
        <div className="flex h-11 items-center justify-between px-5">
          <span className="flex items-center gap-2 text-sm font-medium"><KhatamMark size={18} />{t.brand}</span>
          <span className="rounded-full bg-on-brand/10 px-2.5 py-0.5 text-xs">{result.mode === 'exact' ? t.modeExact : t.modeSummary}</span>
        </div>
      </BrandBar>
      <div className="px-8 pt-7 pb-7">
        <ResultBody text={result.text} cutOff={result.cutOff} report={result.report} titleClass="font-display text-3xl font-semibold" />
        <FollowUps followUps={result.followUps ?? []} live onConnectKey={onConnectKey} />
      </div>
    </article>
  )
}

/** Phones: a compact item at the end of the Thread that opens the Result sheet. */
export function ResultChip({ result, onOpen }: { result: ThreadResult; onOpen: () => void }) {
  const t = useT()
  return (
    <button type="button" onClick={onOpen}
      className="mt-5 flex w-full items-center gap-3 overflow-hidden rounded-card border border-ornament/40 bg-surface p-3.5 text-start shadow-raised transition-transform duration-(--duration-press) active:scale-[0.99]">
      <span className="grid size-10 shrink-0 place-items-center rounded-control bg-brand text-on-brand"><KhatamMark size={22} /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs text-fg-muted">{t.openResult}</span>
        <span className="block truncate font-display text-lg font-semibold" dir="auto">{titleOf(result.text)}</span>
      </span>
      <CaretRightIcon size={18} className="shrink-0 text-fg-subtle rtl:-scale-x-100" />
    </button>
  )
}

/** Phones: the Result rises as a sheet over the Thread, its Follow-ups under it and the box to ask one at its foot. */
export function ResultSheet({ result, open, onClose, onConnectKey }: { result: ThreadResult | null; open: boolean; onClose: () => void; onConnectKey: () => void }) {
  const t = useT()
  return (
    <Sheet open={open && !!result} onClose={onClose} title={t.resultHeading} closeLabel={t.close} footer={<FollowUpBox />}>
      {result && (
        <>
          <ResultBody text={result.text} cutOff={result.cutOff} report={result.report} />
          <FollowUps followUps={result.followUps ?? []} live onConnectKey={onConnectKey} />
        </>
      )}
    </Sheet>
  )
}
