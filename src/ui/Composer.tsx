import { ArrowUpIcon, PlusIcon } from '@phosphor-icons/react'
import { PRESETS, type PresetId } from '@/engine/presets'
import type { Mode } from '@/engine'
import { useT } from '@/i18n/i18n'

/** The Request bar docked under the Thread: Mode, presets, the Request itself, and Summarize. */
export function Composer({ mode, onMode, preset, onPreset, request, onRequest, onAdd, onSummarize, canSummarize }: {
  mode: Mode
  onMode: (mode: Mode) => void
  preset: PresetId | null
  onPreset: (preset: PresetId | null) => void
  request: string
  onRequest: (text: string) => void
  onAdd: () => void
  onSummarize: () => void
  canSummarize: boolean
}) {
  const t = useT()
  return (
    <footer className="relative shrink-0 border-t border-ornament/40 bg-surface pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto max-w-2xl px-3 pt-2.5 pb-3 lg:px-0">
        <div className="-mx-3 mb-2.5 flex items-center gap-2 overflow-x-auto px-3 [scrollbar-width:none]">
          <div role="radiogroup" aria-label={t.mode} className="flex shrink-0 rounded-full bg-sunken p-0.5">
            {(['summary', 'exact'] as const).map(m => (
              <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => onMode(m)}
                className={`h-8 rounded-full px-3 text-sm font-medium transition-colors duration-(--duration-press) ${mode === m ? 'bg-brand text-on-brand' : 'text-fg-muted'}`}>
                {m === 'summary' ? t.modeSummaryShort : t.modeExact}
              </button>
            ))}
          </div>
          {mode === 'summary' && PRESETS.filter(p => p !== 'exact').map(p => (
            <button key={p} type="button" aria-pressed={preset === p} onClick={() => onPreset(preset === p ? null : p)}
              className={`h-9 shrink-0 rounded-full border px-3.5 text-sm transition-colors duration-(--duration-press) ${preset === p ? 'border-accent bg-accent-soft font-medium text-accent' : 'border-line text-fg-muted'}`}>
              {t.presets[p].label}
            </button>
          ))}
        </div>
        <div className="flex items-end gap-2">
          <button type="button" aria-label={t.addSheetTitle} title={t.addSheetTitle} onClick={onAdd}
            className="grid size-11 shrink-0 place-items-center rounded-full bg-sunken text-fg transition-transform duration-(--duration-press) active:scale-[0.94]">
            <PlusIcon size={20} />
          </button>
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">{t.requestLabel}</span>
            <textarea rows={1} dir="auto" value={request} onChange={e => onRequest(e.target.value)} placeholder={t.requestLabel}
              className="block max-h-36 min-h-11 w-full resize-none rounded-[1.375rem] border border-line bg-sunken px-4 py-2.5 leading-6 placeholder:text-fg-subtle focus:border-accent focus:outline-none [field-sizing:content]" />
          </label>
          <button type="button" aria-label={t.summarize} title={t.summarize} onClick={onSummarize} disabled={!canSummarize}
            className="grid size-11 shrink-0 place-items-center rounded-full bg-accent text-on-accent transition-[transform,opacity] duration-(--duration-press) ease-snappy active:scale-[0.94] disabled:opacity-40">
            <ArrowUpIcon size={20} weight="bold" />
          </button>
        </div>
      </div>
    </footer>
  )
}
