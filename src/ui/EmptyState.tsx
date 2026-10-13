import { PlusIcon } from '@phosphor-icons/react'
import { KhatamMark } from '@/brand/Khatam'
import { ArchFrame, OrnamentRule } from '@/brand/Ornament'
import { PRESETS, type PresetId } from '@/engine/presets'
import { useT } from '@/i18n/i18n'
import { PRESET_ICON } from './preset-icons'

/** The first screen: an arch to add Messages, and the preset Requests to choose from. */
export function EmptyState({ picked, onPick, onChooseFiles, onAddText }: {
  picked: PresetId | null
  onPick: (preset: PresetId | null) => void
  onChooseFiles: () => void
  onAddText: () => void
}) {
  const t = useT()

  return (
    <div className="mx-auto max-w-xl px-4 pt-5 pb-8 lg:grid lg:max-w-6xl lg:grid-cols-[5fr_6fr] lg:items-center lg:gap-16 lg:px-8 lg:py-14">
      <ArchFrame className="flex min-h-64 flex-col items-center justify-end px-6 pt-20 pb-6 text-center lg:min-h-[30rem] lg:pb-10">
        <span className="text-ornament"><KhatamMark size={44} /></span>
        <h1 className="mt-3 font-display text-xl font-semibold text-balance">{t.emptyTitle}</h1>
        <p className="mt-1 max-w-[32ch] text-sm text-fg-muted text-pretty">{t.emptyBody}</p>
        <button type="button" onClick={onChooseFiles}
          className="mt-4 inline-flex h-12 items-center gap-2 rounded-full bg-accent px-5 font-medium text-on-accent shadow-raised transition-transform duration-(--duration-press) ease-snappy active:scale-[0.97]">
          <PlusIcon size={18} weight="bold" />
          {t.addMessages}
        </button>
        <button type="button" onClick={onAddText} className="mt-1.5 h-10 rounded-full px-3 text-sm font-medium text-fg-muted transition-[color,transform] duration-(--duration-press) ease-snappy hover:text-fg active:scale-[0.97]">
          {t.addTextMessage}
        </button>
      </ArchFrame>

      <OrnamentRule className="my-7 lg:hidden" />

      <section aria-labelledby="presets-title">
        <h2 id="presets-title" className="font-display text-2xl font-semibold text-balance lg:text-3xl">{t.whatDoYouWant}</h2>
        <OrnamentRule className="my-5 hidden max-w-48 lg:flex" />
        <div className="mt-4 grid grid-cols-2 gap-2.5 lg:grid-cols-3 lg:gap-3">
          {PRESETS.map(id => {
            const Icon = PRESET_ICON[id]
            const on = picked === id
            return (
              <button key={id} type="button" aria-pressed={on} onClick={() => onPick(on ? null : id)}
                className={`flex min-h-[6.25rem] flex-col items-start justify-between rounded-card border p-3.5 text-start transition-[transform,border-color,background-color] duration-(--duration-press) ease-snappy active:scale-[0.97] ${on ? 'border-accent bg-accent-soft' : 'border-line bg-surface hover:border-line-strong'}`}>
                <Icon size={26} className={on ? 'text-accent' : 'text-ornament'} />
                <span>
                  <span className="block font-semibold">{t.presets[id].label}</span>
                  <span className="block text-sm text-fg-muted">{t.presets[id].hint}</span>
                </span>
              </button>
            )
          })}
        </div>
      </section>
    </div>
  )
}
