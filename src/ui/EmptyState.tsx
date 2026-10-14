import { PlusIcon } from '@phosphor-icons/react'
import { KhatamMark } from '@/brand/Khatam'
import { ArchFrame } from '@/brand/Ornament'
import { useT } from '@/i18n/i18n'

/**
 * The first screen: only the arch, to add Messages, filling the screen. What to make of them (the
 * presets, the Request) comes once there is something to make it from, under the Thread.
 */
export function EmptyState({ arrives, onChooseFiles, onAddText }: {
  /** Shown again after Start over: it fades in rather than replacing the Thread at once. */
  arrives: boolean
  onChooseFiles: () => void
  onAddText: () => void
}) {
  const t = useT()

  return (
    <div className={`flex min-h-full items-center justify-center px-4 py-6 lg:px-10 lg:py-10 ${arrives ? 'arrives' : ''}`}>
      <ArchFrame className="flex min-h-[min(70dvh,34rem)] w-full max-w-md flex-col items-center justify-end px-6 pt-24 pb-8 text-center lg:aspect-[4/5] lg:h-[clamp(26rem,100dvh_-_10rem,46rem)] lg:min-h-0 lg:w-auto lg:max-w-none lg:px-12 lg:pb-14 2xl:h-[clamp(26rem,100dvh_-_10rem,50rem)] 2xl:pb-16 3xl:h-[clamp(26rem,100dvh_-_10rem,60rem)] 3xl:pb-20">
        <span className="text-ornament"><KhatamMark size={52} className="lg:size-16 3xl:size-20" /></span>
        <h2 className="mt-4 font-display text-2xl font-semibold text-balance xl:text-3xl 3xl:text-4xl">{t.emptyTitle}</h2>
        <p className="mt-2 max-w-[32ch] text-fg-muted text-pretty xl:text-lg 3xl:text-xl">{t.emptyBody}</p>
        <button type="button" onClick={onChooseFiles}
          className="mt-6 inline-flex min-h-13 items-center gap-2 rounded-full bg-accent hover:bg-accent-strong px-6 py-2 font-medium text-on-accent sm:text-lg shadow-raised transition-[background-color,scale] duration-(--duration-press) ease-snappy motion-safe:active:scale-[0.97] 2xl:min-h-14 2xl:px-7 3xl:min-h-16 3xl:px-9 3xl:text-xl">
          <PlusIcon size={20} weight="bold" className="shrink-0" />
          {t.addMessages}
        </button>
        <button type="button" onClick={onAddText} className="mt-2 h-11 rounded-full px-4 font-medium text-fg-muted transition-[color,scale] duration-(--duration-press) ease-snappy hover:text-fg motion-safe:active:scale-[0.97] 3xl:text-lg">
          {t.addTextMessage}
        </button>
      </ArchFrame>
    </div>
  )
}
