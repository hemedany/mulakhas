import { useEffect, useState } from 'react'
import type { SavedResult } from '@/engine'
import { useT } from '@/i18n/i18n'
import { useEngine, usePrefs } from './engine-hooks'

export function HistoryList() {
  const { history } = useEngine()
  const { uiLang } = usePrefs()
  const t = useT()
  const [saved, setSaved] = useState<SavedResult[] | null>(null)

  useEffect(() => {
    history.list().then(setSaved)
  }, [history])

  if (!saved) return null
  if (!saved.length) return <p className="text-sm text-fg-muted">{t.historyEmpty}</p>

  const date = new Intl.DateTimeFormat(uiLang, { dateStyle: 'medium', timeStyle: 'short' })
  return (
    <ul className="divide-y divide-line">
      {saved.map(r => (
        <li key={r.id} className="py-3">
          <p className="truncate font-medium">{r.title}</p>
          <p className="mt-0.5 text-xs text-fg-muted">
            {[
              date.format(r.createdAt),
              r.mode === 'exact' ? t.historyExact : t.historySummary,
              ...(r.files.length ? [t.filesCount(r.files.length)] : []),
            ].join(t.listSeparator)}
          </p>
        </li>
      ))}
    </ul>
  )
}
