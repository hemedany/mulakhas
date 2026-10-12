import { XIcon } from '@phosphor-icons/react'
import { useEffect, useId, useRef, type ReactNode } from 'react'
import { KhatamMark } from '@/brand/Khatam'
import { BrandBar } from '@/brand/Ornament'

// A modal sheet on the native <dialog> element (ADR-0005): the browser handles focus trapping,
// Escape and the top layer, and nothing injects <style> elements, which the CSP forbids. It rises
// from the bottom on phones and sits centred on wide screens.
export function Sheet({ open, onClose, title, closeLabel, children }: {
  open: boolean
  onClose: () => void
  title: string
  closeLabel: string
  children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      // A click that lands on the dialog itself (not the panel) is a click on the dimmed area.
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      className="sheet m-0 size-full max-h-none max-w-none bg-transparent p-0 open:flex open:items-end lg:open:items-center lg:open:justify-center"
    >
      <div className="sheet-panel flex max-h-[88dvh] w-full flex-col overflow-hidden rounded-t-sheet bg-surface text-fg shadow-floating lg:max-h-[80dvh] lg:max-w-lg lg:rounded-sheet">
        <BrandBar patternClassName="opacity-[0.22]">
          <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-on-brand/40 lg:hidden" aria-hidden="true" />
          <div className="flex h-12 items-center justify-between px-4 lg:h-13">
            <h2 id={titleId} className="flex items-center gap-2 text-sm font-medium"><KhatamMark size={18} />{title}</h2>
            <button type="button" aria-label={closeLabel} onClick={onClose}
              className="grid size-10 place-items-center rounded-full transition-colors duration-(--duration-press) hover:bg-on-brand/10">
              <XIcon size={20} />
            </button>
          </div>
        </BrandBar>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">{children}</div>
      </div>
    </dialog>
  )
}
