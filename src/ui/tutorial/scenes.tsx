// Miniature screens for the tutorial: the app's own pieces (star badges, bubbles, chips, the Result
// card) at a glance, not screenshots. Decoration only, so hidden from screen readers.
import { ArrowUpIcon, CheckIcon, MicrophoneIcon, PlayIcon, ShareNetworkIcon, VideoCameraIcon } from '@phosphor-icons/react'
import type { ReactNode } from 'react'
import { KhatamMark } from '@/brand/Khatam'
import { BrandBar, Pattern, StarBadge } from '@/brand/Ornament'
import { usePrefs } from '@/app/engine-hooks'
import { useT } from '@/i18n/i18n'
import { formatNumber } from '@/i18n/numbers'

export type TutorialStep = 'key' | 'add' | 'share' | 'ask' | 'result'

function Frame({ children }: { children: ReactNode }) {
  return (
    <div aria-hidden="true" className="relative flex h-44 flex-col justify-center gap-2 overflow-hidden rounded-card border border-ornament/40 bg-bg px-4 py-3 select-none">
      <Pattern className="opacity-[0.06]" />
      <div className="relative flex flex-col gap-2">{children}</div>
    </div>
  )
}

/** A voice note's waveform, drawn as a few bars of fixed heights. */
const Wave = () => (
  <span className="flex h-5 flex-1 items-center gap-[3px]">
    {['h-1.5', 'h-3', 'h-2', 'h-4', 'h-2', 'h-3', 'h-4.5', 'h-2.5', 'h-1.5', 'h-3.5', 'h-2', 'h-3', 'h-1'].map((h, i) => <span key={i} className={`w-[3px] rounded-full bg-fg-subtle ${h}`} />)}
  </span>
)

export function Scene({ step }: { step: TutorialStep }) {
  const t = useT()
  const { uiLang } = usePrefs()
  switch (step) {
    case 'key':
      return (
        <Frame>
          <span className="text-xs font-semibold text-fg-muted">{t.keyLabel.groq}</span>
          <div className="flex items-center gap-2">
            <span className="flex h-10 flex-1 items-center rounded-control border border-line bg-surface px-3 font-mono text-sm text-fg-muted" dir="ltr">gsk_••••••••••••</span>
            <span className="flex h-10 items-center rounded-control bg-accent px-3 text-sm font-medium text-on-accent">{t.connect}</span>
          </div>
          <span className="inline-flex items-center gap-1 text-xs text-fg-muted"><CheckIcon size={14} weight="bold" className="text-ornament" />{t.connected}</span>
        </Frame>
      )
    case 'add':
      return (
        <Frame>
          <div className="flex items-center gap-2">
            <StarBadge n={1} lang={uiLang} />
            <span className="flex flex-1 items-center gap-2 rounded-card rounded-ss-md border border-line bg-surface px-2.5 py-1.5 shadow-raised">
              <span className="grid size-6 place-items-center rounded-full bg-accent-soft text-accent"><PlayIcon size={12} weight="fill" /></span>
              <Wave />
            </span>
          </div>
          <div className="flex items-center gap-2">
            <StarBadge n={2} lang={uiLang} />
            <span dir="auto" className="flex-1 rounded-card rounded-ss-md border border-brand/15 bg-brand-soft px-3 py-1.5 text-sm">{t.tutorial.sampleText}</span>
          </div>
          <div className="flex items-center gap-2">
            <StarBadge n={3} lang={uiLang} />
            <span className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-card rounded-ss-md border border-line bg-sunken text-fg-muted"><VideoCameraIcon size={16} /></span>
          </div>
        </Frame>
      )
    case 'share':
      return (
        <Frame>
          <span className="flex w-3/4 items-center gap-2 self-start rounded-card rounded-ss-md bg-surface px-2.5 py-1.5 shadow-raised">
            <MicrophoneIcon size={14} className="text-fg-muted" /><Wave />
          </span>
          <div className="mt-1 flex items-end justify-center gap-4">
            <span className="flex flex-col items-center gap-1 text-[0.7rem] text-fg-muted"><span className="grid size-10 place-items-center rounded-full bg-sunken"><ShareNetworkIcon size={18} /></span>…</span>
            <span className="flex flex-col items-center gap-1 text-[0.7rem] font-semibold">
              <span className="grid size-12 place-items-center rounded-full bg-brand text-on-brand ring-2 ring-ornament ring-offset-2 ring-offset-bg"><KhatamMark size={24} /></span>
              {t.brand}
            </span>
            <span className="flex flex-col items-center gap-1 text-[0.7rem] text-fg-muted"><span className="grid size-10 place-items-center rounded-full bg-sunken" />…</span>
          </div>
        </Frame>
      )
    case 'ask':
      return (
        <Frame>
          <div className="flex gap-1.5">
            <span className="h-8 rounded-full border border-accent bg-accent-soft px-3 text-sm leading-8 font-medium text-accent">{t.presets.recipe.label}</span>
            <span className="h-8 rounded-full border border-line px-3 text-sm leading-8 text-fg-muted">{t.presets.steps.label}</span>
            <span className="h-8 rounded-full border border-line px-3 text-sm leading-8 text-fg-muted">{t.presets.todo.label}</span>
          </div>
          <div className="flex items-center gap-2">
            <span dir="auto" className="flex h-10 flex-1 items-center justify-between rounded-control border border-line bg-sunken ps-3 pe-2 text-sm">
              {t.tutorial.sampleRequest}<MicrophoneIcon size={16} className="text-fg-muted" />
            </span>
            <span className="grid size-10 place-items-center rounded-full bg-accent text-on-accent"><ArrowUpIcon size={18} weight="bold" /></span>
          </div>
        </Frame>
      )
    case 'result':
      return (
        <Frame>
          <div className="overflow-hidden rounded-card border border-ornament/40 bg-surface shadow-raised">
            <BrandBar patternClassName="opacity-[0.22]">
              <span className="flex h-7 items-center gap-1.5 px-3 text-xs font-medium"><KhatamMark size={14} />{t.brand}</span>
            </BrandBar>
            <div className="space-y-1.5 px-3 py-2.5 text-sm">
              <span className="block font-display text-base font-semibold">{t.presets.recipe.label}</span>
              <span className="block h-2 w-4/5 rounded-full bg-sunken" />
              <span className="block h-2 w-3/5 rounded-full bg-sunken" />
              <span className="flex items-center gap-2 text-xs text-fg-muted">
                <span className="tabular font-semibold text-fg">{formatNumber(92, uiLang)}%</span>{t.reliability}
              </span>
            </div>
          </div>
        </Frame>
      )
  }
}
