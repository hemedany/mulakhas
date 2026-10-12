import type { Icon } from '@phosphor-icons/react'
import { ArrowDownIcon, ArrowUpIcon, ChatTextIcon, TrashIcon } from '@phosphor-icons/react'
import { useEngine, usePrefs, useThread } from '@/app/engine-hooks'
import { useT } from '@/i18n/i18n'
import { formatNumber } from '@/i18n/numbers'
import { Sheet } from '../Sheet'

function Action({ icon: I, label, onClick, disabled = false, danger = false }: { icon: Icon; label: string; onClick: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={`flex h-13 w-full items-center gap-3 text-start transition-opacity duration-(--duration-press) disabled:opacity-35 ${danger ? 'text-danger' : ''}`}>
      <I size={20} className={`shrink-0 ${danger ? '' : 'text-accent'}`} />
      {label}
    </button>
  )
}

/** Move, insert around, or remove one Message. */
export function MessageOptions({ id, onClose, onTextAdded }: { id: string | null; onClose: () => void; onTextAdded: (id: string) => void }) {
  const t = useT()
  const { uiLang } = usePrefs()
  const { thread } = useEngine()
  const { messages } = useThread()
  const index = messages.findIndex(m => m.id === id)
  if (!id || index < 0) return <Sheet open={false} onClose={onClose} title="" closeLabel={t.close}>{null}</Sheet>
  const closeThen = (fn: () => Promise<unknown>) => async () => { onClose(); await fn() }

  return (
    <Sheet open onClose={onClose} title={t.messageOptionsFor(formatNumber(index + 1, uiLang))} closeLabel={t.close}>
      <div className="divide-y divide-line">
        <Action icon={ArrowUpIcon} label={t.moveUp} disabled={index === 0} onClick={closeThen(() => thread.moveBy(id, -1))} />
        <Action icon={ArrowDownIcon} label={t.moveDown} disabled={index === messages.length - 1} onClick={closeThen(() => thread.moveBy(id, 1))} />
        <Action icon={ChatTextIcon} label={t.addTextAbove} onClick={closeThen(async () => onTextAdded(await thread.addTextNear(id, 'above')))} />
        <Action icon={ChatTextIcon} label={t.addTextBelow} onClick={closeThen(async () => onTextAdded(await thread.addTextNear(id, 'below')))} />
        <Action icon={TrashIcon} label={t.removeMessage} danger onClick={closeThen(() => thread.remove(id))} />
      </div>
    </Sheet>
  )
}
