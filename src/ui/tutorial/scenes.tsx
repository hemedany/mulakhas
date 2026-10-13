// Miniature screens for the tutorial, made from the app's own pieces (star badges, the voice note
// player, bubbles, chips, the Result card) so they look like what the person will see. Decoration
// only, so hidden from screen readers.
import { ArrowUpIcon, MicrophoneIcon, PlayIcon, ShareNetworkIcon, VideoCameraIcon } from '@phosphor-icons/react'
import type { ReactNode } from 'react'
import { KhatamMark } from '@/brand/Khatam'
import { BrandBar, Pattern, StarBadge } from '@/brand/Ornament'
import { usePrefs } from '@/app/engine-hooks'
import { useT } from '@/i18n/i18n'
import { formatNumber, formatPercent } from '@/i18n/numbers'
import type { TutorialStep } from './steps'

function Frame({ children }: { children: ReactNode }) {
  return (
    <div aria-hidden="true" className="relative flex h-44 flex-col justify-center gap-2 overflow-hidden rounded-card border border-ornament/40 bg-bg px-4 py-3 select-none">
      <Pattern className="opacity-[0.06]" />
      <div className="relative flex flex-col gap-2">{children}</div>
    </div>
  )
}

/** The voice note player, as in a Message: play, a progress track, the length. */
function Player({ seconds }: { seconds: string }) {
  return (
    <span className="flex flex-1 items-center gap-2 rounded-card rounded-ss-md border border-line bg-surface px-2.5 py-1.5 shadow-raised">
      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent-soft text-accent"><PlayIcon size={12} weight="fill" /></span>
      <span className="relative h-1 flex-1 overflow-hidden rounded-full bg-line"><span className="absolute inset-y-0 start-0 w-1/3 rounded-full bg-accent" /></span>
      <span className="tabular text-xs text-fg-muted">{seconds}</span>
    </span>
  )
}

export function Scene({ step }: { step: TutorialStep }) {
  const t = useT()
  const { uiLang } = usePrefs()
  switch (step) {
    case 'key':
      return (
        <Frame>
          <span className="text-xs font-semibold text-fg-muted">{t.keyLabel.groq}</span>
          <div className="flex items-center gap-2">
            <span className="flex h-10 flex-1 items-center rounded-control border border-line bg-surface px-3 text-sm text-fg-muted" dir="ltr">gsk_••••••••••••</span>
            <span className="flex h-10 items-center rounded-control bg-accent px-3 text-sm font-medium text-on-accent">{t.connect}</span>
          </div>
        </Frame>
      )
    case 'add':
      return (
        <Frame>
          <div className="flex items-center gap-2"><StarBadge n={1} lang={uiLang} /><Player seconds="0:42" /></div>
          <div className="flex items-center gap-2">
            <StarBadge n={2} lang={uiLang} />
            <span dir="auto" className="flex-1 rounded-card rounded-ss-md border border-brand/15 bg-brand-soft px-3 py-1.5 text-sm">{t.tutorial.sampleText}</span>
          </div>
          <div className="flex items-center gap-2">
            <StarBadge n={3} lang={uiLang} />
            <span className="flex h-9 flex-1 items-center justify-center rounded-card rounded-ss-md border border-line bg-sunken text-fg-muted"><VideoCameraIcon size={16} /></span>
          </div>
        </Frame>
      )
    case 'share':
      return (
        <Frame>
          <span className="flex w-3/4 self-start"><Player seconds="1:05" /></span>
          <div className="mt-1 flex items-end justify-center gap-4">
            <span className="flex flex-col items-center gap-1 text-xs text-fg-muted"><span className="grid size-10 place-items-center rounded-full bg-sunken"><ShareNetworkIcon size={18} /></span>…</span>
            <span className="flex flex-col items-center gap-1 text-xs font-semibold">
              <span className="grid size-12 place-items-center rounded-full bg-brand text-on-brand ring-2 ring-ornament ring-offset-2 ring-offset-bg"><KhatamMark size={24} /></span>
              {t.brand}
            </span>
            <span className="flex flex-col items-center gap-1 text-xs text-fg-muted"><span className="grid size-10 place-items-center rounded-full bg-sunken" />…</span>
          </div>
        </Frame>
      )
    case 'request':
      return (
        <Frame>
          <div className="flex items-center gap-1.5">
            <span className="flex shrink-0 rounded-full bg-sunken p-0.5 text-xs font-medium">
              <span className="rounded-full bg-brand px-2.5 py-1 text-on-brand">{t.modeSummary}</span>
              <span className="px-2.5 py-1 text-fg-muted">{t.modeExact}</span>
            </span>
            <span className="h-7 shrink-0 rounded-full border border-accent bg-accent-soft px-2.5 text-xs leading-7 font-medium text-accent">{t.presets.recipe.label}</span>
          </div>
          <div className="flex items-center gap-2">
            <span dir="auto" className="flex h-10 min-w-0 flex-1 items-center justify-between gap-2 rounded-control border border-line bg-sunken ps-3 pe-2 text-sm">
              <span className="truncate">{t.tutorial.sampleRequest}</span><MicrophoneIcon size={16} className="shrink-0 text-fg-muted" />
            </span>
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent text-on-accent"><ArrowUpIcon size={18} weight="bold" /></span>
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
            <div className="space-y-1.5 px-3 py-2.5 text-xs">
              <span className="block font-display text-base font-semibold">{t.presets.recipe.label}</span>
              <span className="block h-2 w-4/5 rounded-full bg-sunken" />
              {[[1, 92], [2, 78]].map(([n, clarity]) => (
                <span key={n} className="flex gap-2">
                  <span className="tabular w-9 font-semibold">{formatPercent(clarity, uiLang)}</span>
                  <span className="text-fg-muted">{t.clarityOf(formatNumber(n, uiLang))}</span>
                </span>
              ))}
            </div>
          </div>
        </Frame>
      )
  }
}
