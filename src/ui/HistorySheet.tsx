import { MagnifyingGlassIcon, TrashIcon } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import { useEngine, usePrefs } from '@/app/engine-hooks'
import type { SavedResult } from '@/engine'
import { useT } from '@/i18n/i18n'
import { ResultBody } from './result/ResultBody'
import { Sheet } from './Sheet'

/** Saved Results: search, open, delete. */
export function HistorySheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { history } = useEngine()
  const { uiLang } = usePrefs()
  const t = useT()
  const [saved, setSaved] = useState<SavedResult[]>([])
  const [query, setQuery] = useState('')
  const [opened, setOpened] = useState<SavedResult | null>(null)

  useEffect(() => { if (open) void history.list().then(setSaved) }, [history, open])

  const q = query.trim().toLowerCase()
  const shown = q ? saved.filter(r => `${r.title}\n${r.text}`.toLowerCase().includes(q)) : saved
  const date = new Intl.DateTimeFormat(uiLang, { dateStyle: 'medium', timeStyle: 'short' })

  return (
    <>
      <Sheet open={open && !opened} onClose={onClose} title={t.historyTitle} closeLabel={t.close}>
        {saved.length > 0 && (
          <label className="relative mb-2 block">
            <span className="sr-only">{t.historySearch}</span>
            <MagnifyingGlassIcon size={18} className="pointer-events-none absolute start-3 top-3.5 text-fg-subtle" />
            <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder={t.historySearch}
              className="h-12 w-full rounded-control border border-line bg-sunken ps-10 pe-3 placeholder:text-fg-subtle focus:border-accent focus:outline-none" />
          </label>
        )}
        {shown.length === 0 ? (
          <p className="py-6 text-center text-sm text-fg-muted">{t.historyEmpty}</p>
        ) : (
          <ul className="divide-y divide-line">
            {shown.map(r => (
              <li key={r.id} className="flex items-center gap-2">
                <button type="button" onClick={() => setOpened(r)} className="min-w-0 flex-1 py-3 text-start">
                  <span className="block truncate font-medium" dir="auto">{r.title}</span>
                  <span className="mt-0.5 block text-xs text-fg-muted">
                    {[date.format(r.createdAt), r.mode === 'exact' ? t.historyExact : t.historySummary, ...(r.files.length ? [t.filesCount(r.files.length)] : [])].join(t.listSeparator)}
                  </span>
                </button>
                <button type="button" aria-label={`${t.deleteSaved}: ${r.title}`} title={t.deleteSaved}
                  onClick={async () => { await history.remove(r.id); setSaved(s => s.filter(x => x.id !== r.id)) }}
                  className="grid size-10 shrink-0 place-items-center rounded-full text-fg-subtle transition-colors duration-(--duration-press) hover:bg-sunken hover:text-danger">
                  <TrashIcon size={18} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Sheet>
      <Sheet open={open && !!opened} onClose={() => setOpened(null)} title={t.resultHeading} closeLabel={t.close}>
        {opened && <ResultBody text={opened.text} report={opened.report} />}
      </Sheet>
    </>
  )
}
