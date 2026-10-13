import { ArrowUpIcon, PlusIcon } from '@phosphor-icons/react'
import { useT } from '@/i18n/i18n'

/** The round + at the start of the Request and Follow-up bars: add Messages, a Text message, or start over. */
export function AddButton({ onAdd }: { onAdd: () => void }) {
  const t = useT()
  return (
    <button type="button" aria-label={t.addSheetTitle} title={t.addSheetTitle} onClick={onAdd}
      className="grid size-11 shrink-0 place-items-center rounded-full bg-sunken text-fg transition-transform duration-(--duration-press) ease-snappy motion-safe:active:scale-[0.94]">
      <PlusIcon size={20} />
    </button>
  )
}

/** The round send arrow at the end of the Request and Follow-up bars. */
export function SendButton({ label, disabled }: { label: string; disabled: boolean }) {
  return (
    <button type="submit" aria-label={label} title={label} disabled={disabled}
      className="grid size-11 shrink-0 place-items-center rounded-full bg-accent hover:bg-accent-strong text-on-accent transition-[background-color,scale,opacity] duration-(--duration-press) ease-snappy motion-safe:active:scale-[0.94] disabled:opacity-40">
      <ArrowUpIcon size={20} weight="bold" />
    </button>
  )
}
