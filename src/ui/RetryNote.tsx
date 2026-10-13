import { usePrefs } from '@/app/engine-hooks'
import { useT } from '@/i18n/i18n'

/** When a provider that asked us to wait will be tried again. */
export function RetryNote({ at, className }: { at: number; className: string }) {
  const t = useT()
  const { uiLang } = usePrefs()
  return <p className={className}>{t.retryingAt(new Intl.DateTimeFormat(uiLang, { timeStyle: 'short' }).format(at))}</p>
}
