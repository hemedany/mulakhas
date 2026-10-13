import { useLayoutEffect, useRef, useState } from 'react'
import { PlusIcon } from '@phosphor-icons/react'
import { useIsDesktop } from '@/app/engine-hooks'
import { KhatamMark } from '@/brand/Khatam'
import { ArchFrame, OrnamentRule } from '@/brand/Ornament'
import { PRESETS, type PresetId } from '@/engine/presets'
import { useT } from '@/i18n/i18n'
import { placeOpening } from './opening'
import { PRESET_ICON } from './preset-icons'

/**
 * The first screen: an arch to add Messages, and the preset Requests to choose from. On a wide
 * screen the two fill it, centred, and open in two beats: the arch alone, then the presets out of it.
 */
export function EmptyState({ arrives, picked, onPick, onChooseFiles, onAddText }: {
  /** Shown again after Start over: on a phone it fades in rather than replacing the Thread at once. */
  arrives: boolean
  picked: PresetId | null
  onPick: (preset: PresetId | null) => void
  onChooseFiles: () => void
  onAddText: () => void
}) {
  const t = useT()
  const desktop = useIsDesktop()
  const [opensWide] = useState(desktop)
  const screen = useRef<HTMLDivElement>(null)
  const arch = useRef<HTMLDivElement>(null)

  // Measured in the finished layout before the first paint; the opening then starts from there.
  useLayoutEffect(() => {
    const el = screen.current!
    if (!opensWide) return
    const pieces = (selector: string) => [...el.querySelectorAll<HTMLElement>(selector)]
    placeOpening(el, arch.current!, pieces('[data-opening=preset]'), pieces('[data-opening=preset][aria-pressed]'))
    el.classList.add('opening')
    return () => el.classList.remove('opening')
  }, [opensWide])

  return (
    <div ref={screen} className={`mx-auto max-w-xl px-4 pt-5 pb-8 ${arrives && !desktop ? 'arrives' : ''} lg:flex lg:min-h-full lg:max-w-[104rem] lg:items-center lg:gap-12 lg:px-10 lg:py-10 xl:gap-16 xl:px-14 2xl:gap-24 3xl:max-w-[140rem] 3xl:gap-32`}>
      <ArchFrame ref={arch} data-opening="arch"
        className="flex min-h-64 flex-col items-center justify-end px-6 pt-20 pb-6 text-center lg:aspect-[4/5] lg:h-[clamp(26rem,100dvh_-_10rem,36rem)] lg:min-h-0 lg:shrink-0 lg:px-10 lg:pb-12 xl:h-[clamp(26rem,100dvh_-_10rem,46rem)] 2xl:h-[clamp(26rem,100dvh_-_10rem,50rem)] 2xl:pb-16 3xl:h-[clamp(26rem,100dvh_-_10rem,60rem)] 3xl:pb-20">
        <span className="text-ornament"><KhatamMark size={44} className="lg:size-14 2xl:size-16 3xl:size-20" /></span>
        <h2 className="mt-3 font-display text-xl font-semibold text-balance xl:mt-4 xl:text-2xl 2xl:text-3xl 3xl:text-4xl">{t.emptyTitle}</h2>
        <p className="mt-1 max-w-[32ch] text-sm text-fg-muted text-pretty xl:mt-2 xl:text-base 2xl:text-lg 3xl:text-xl">{t.emptyBody}</p>
        <button type="button" onClick={onChooseFiles}
          className="mt-4 inline-flex min-h-12 items-center gap-2 rounded-full bg-accent hover:bg-accent-strong px-5 py-2 font-medium text-on-accent shadow-raised transition-[background-color,scale] duration-(--duration-press) ease-snappy motion-safe:active:scale-[0.97] xl:mt-6 2xl:min-h-14 2xl:px-7 2xl:text-lg 3xl:min-h-16 3xl:px-9 3xl:text-xl">
          <PlusIcon size={18} weight="bold" className="shrink-0" />
          {t.addMessages}
        </button>
        <button type="button" onClick={onAddText} className="mt-1.5 h-10 rounded-full px-3 text-sm font-medium text-fg-muted transition-[color,scale] duration-(--duration-press) ease-snappy hover:text-fg motion-safe:active:scale-[0.97] xl:mt-2 xl:text-base 2xl:h-12 3xl:text-lg">
          {t.addTextMessage}
        </button>
      </ArchFrame>

      <OrnamentRule className="my-7 lg:hidden" />

      <section aria-labelledby="presets-title" className="lg:min-w-0 lg:flex-1">
        <h2 id="presets-title" data-opening="preset" className="font-display text-2xl font-semibold text-balance lg:text-3xl xl:text-4xl 2xl:text-5xl 3xl:text-6xl">{t.whatDoYouWant}</h2>
        <OrnamentRule data-opening="preset" className="my-5 hidden max-w-48 lg:flex xl:my-7 xl:max-w-64 3xl:my-9 3xl:max-w-80" />
        <div className="mt-4 grid grid-cols-2 gap-2.5 lg:gap-3 xl:grid-cols-3 2xl:gap-4 3xl:gap-5">
          {PRESETS.map(id => {
            const Icon = PRESET_ICON[id]
            const on = picked === id
            return (
              <button key={id} type="button" aria-pressed={on} data-opening="preset" onClick={() => onPick(on ? null : id)}
                className={`flex min-h-[6.25rem] flex-col items-start justify-between rounded-card border p-3.5 text-start transition-[scale,border-color,background-color] duration-(--duration-press) ease-snappy motion-safe:active:scale-[0.97] lg:min-h-[clamp(6.25rem,19dvh,13rem)] lg:gap-3 xl:p-5 3xl:min-h-[clamp(6.25rem,19dvh,15rem)] 3xl:p-7 ${on ? 'border-accent bg-accent-soft' : 'border-line bg-surface hover:border-line-strong'}`}>
                <Icon size={26} className={`xl:size-8 2xl:size-9 3xl:size-11 ${on ? 'text-accent' : 'text-ornament'}`} />
                <span>
                  <span className="block font-semibold xl:text-lg 2xl:text-xl 3xl:text-2xl">{t.presets[id].label}</span>
                  <span className="block text-sm text-fg-muted xl:text-base 3xl:text-lg">{t.presets[id].hint}</span>
                </span>
              </button>
            )
          })}
        </div>
      </section>
    </div>
  )
}
