import type { Icon } from '@phosphor-icons/react'
import { ArrowDownIcon, ArrowUpIcon, ChatTextIcon, TrashIcon } from '@phosphor-icons/react'
import { useEngine, useThread } from '@/app/engine-hooks'
import { useT } from '@/i18n/i18n'
import { Sheet } from '../Sheet'

function Action({ icon: I, label, onClick, disabled = false, danger = false }: { icon: Icon; label: string; onClick: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={`flex h-13 w-full items-center gap-3 text-start transition-colors disabled:opacity-35 ${danger ? 'text-danger' : ''}`}>
      <I size={20} className="shrink-0 rtl:-scale-x-100" />
      {label}
    </button>
  )
}

/** Move, insert around, or remove one Message. */
export function MessageOptions({ id, onClose, onTextAdded }: { id: string | null; onClose: () => void; onTextAdded: (id: string) => void }) {
  const t = useT()
  const { thread } = useEngine()
  const { messages } = useThread()
  const index = messages.findIndex(m => m.id === id)
  const act = (fn: () => Promise<unknown>) => async () => { onClose(); await fn() }

  return (
    <Sheet open={id !== null && index >= 0} onClose={onClose} title={`${t.messageOptions} ${index + 1}`} closeLabel={t.close}>
      <div className="divide-y divide-line">
        <Action icon={ArrowUpIcon} label={t.moveUp} disabled={index <= 0} onClick={act(() => thread.move(id!, index - 1))} />
        <Action icon={ArrowDownIcon} label={t.moveDown} disabled={index >= messages.length - 1} onClick={act(() => thread.move(id!, index + 1))} />
        <Action icon={ChatTextIcon} label={t.addTextAbove} onClick={act(async () => onTextAdded(await thread.addText(index)))} />
        <Action icon={ChatTextIcon} label={t.addTextBelow} onClick={act(async () => onTextAdded(await thread.addText(index + 1)))} />
        <Action icon={TrashIcon} label={t.removeMessage} danger onClick={act(() => thread.remove(id!))} />
      </div>
    </Sheet>
  )
}
