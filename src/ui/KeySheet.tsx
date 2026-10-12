import { ArrowSquareOutIcon, CheckCircleIcon } from '@phosphor-icons/react'
import { useId, useState, type ReactNode } from 'react'
import { OrnamentRule, StarBadge } from '@/brand/Ornament'
import { useEngine, useOwnKeys, usePrefs } from '@/app/engine-hooks'
import type { ConnectOutcome, Provider } from '@/engine'
import { useT } from '@/i18n/i18n'
import { Sheet } from './Sheet'

const KEY_PAGES: Record<Provider, string> = {
  groq: 'https://console.groq.com/keys',
  gemini: 'https://aistudio.google.com/apikey',
}
const PROVIDER_NAME: Record<Provider, string> = { groq: 'Groq', gemini: 'Google' }

/** Shows only the first and last few characters, enough to recognise a key without exposing it. */
function masked(key: string) {
  return key.length <= 10 ? '••••' : `${key.slice(0, 4)}…${key.slice(-4)}`
}

function Step({ n, children }: { n: number; children: ReactNode }) {
  const { uiLang } = usePrefs()
  return (
    <li className="flex gap-3">
      <StarBadge n={n} lang={uiLang} />
      <div className="min-w-0 flex-1 pt-1">{children}</div>
    </li>
  )
}

function OpenLink({ href, label }: { href: string; label: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
      className="mt-2 inline-flex h-10 items-center gap-1.5 rounded-full border border-line px-4 text-sm font-medium transition-colors hover:border-line-strong">
      {label}
      <ArrowSquareOutIcon size={16} className="rtl:-scale-x-100" />
    </a>
  )
}

/** Paste a key, check it with its provider, and show the outcome where the user is looking. */
function KeyField({ provider, label }: { provider: Provider; label: string }) {
  const { keys } = useEngine()
  const current = useOwnKeys()[provider]
  const t = useT()
  const inputId = useId()
  const [value, setValue] = useState('')
  const [editing, setEditing] = useState(!current)
  const [busy, setBusy] = useState(false)
  const [outcome, setOutcome] = useState<ConnectOutcome | null>(null)

  if (current && !editing) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-control border border-line bg-sunken px-3.5 py-2.5">
        <span className="flex min-w-0 items-center gap-2">
          <CheckCircleIcon size={20} weight="fill" className="shrink-0 text-accent" />
          <span className="min-w-0">
            <span className="block text-sm font-medium">{label}: {t.connected}</span>
            <span className="block truncate text-xs text-fg-muted" dir="ltr">{masked(current)}</span>
          </span>
        </span>
        <span className="flex shrink-0 gap-1">
          <button type="button" onClick={() => { setEditing(true); setOutcome(null) }} className="h-9 rounded-full px-3 text-sm font-medium text-accent">{t.change}</button>
          <button type="button" onClick={() => keys.remove(provider)} className="h-9 rounded-full px-3 text-sm font-medium text-fg-muted">{t.remove}</button>
        </span>
      </div>
    )
  }

  const error = outcome && !outcome.ok
    ? outcome.reason === 'empty' ? t.keyEmpty : outcome.reason === 'rejected' ? t.keyRejected : t.keyUnreachable(PROVIDER_NAME[provider])
    : null

  return (
    <form
      onSubmit={async e => {
        e.preventDefault()
        setBusy(true)
        const result = await keys.connect(provider, value)
        setBusy(false)
        setOutcome(result)
        if (result.ok) { setValue(''); setEditing(false) }
      }}
    >
      <label htmlFor={inputId} className="mb-1.5 block text-sm font-semibold">{label}</label>
      <div className="flex gap-2">
        <input
          id={inputId}
          value={value}
          onChange={e => { setValue(e.target.value); setOutcome(null) }}
          dir="ltr"
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="done"
          placeholder={provider === 'groq' ? 'gsk_…' : 'AIza…'}
          aria-invalid={!!error}
          aria-describedby={error ? `${inputId}-error` : undefined}
          className="h-12 min-w-0 flex-1 rounded-control border border-line bg-sunken px-3.5 placeholder:text-fg-subtle focus:border-accent focus:outline-none aria-invalid:border-danger"
        />
        <button type="submit" disabled={busy}
          className="h-12 shrink-0 rounded-control bg-accent px-5 font-medium text-on-accent transition-[transform,opacity] duration-150 ease-snappy active:scale-[0.97] disabled:opacity-60">
          {busy ? t.checking : t.connect}
        </button>
      </div>
      <p id={`${inputId}-error`} role="status" aria-live="polite" className="mt-1.5 min-h-5 text-sm text-danger">{error}</p>
    </form>
  )
}

/** The Own-key sheet: Groq is required to hear Voice notes; a Gemini key optionally lets Mulakhas watch Videos. */
export function KeySheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT()
  const { gemini } = useOwnKeys()

  return (
    <Sheet open={open} onClose={onClose} title={t.keySheetTitle} closeLabel={t.close}>
      <p className="text-fg-muted text-pretty">{t.keyIntro}</p>
      <ol className="mt-5 space-y-4">
        <Step n={1}>
          <p>{t.keyStep1}</p>
          <OpenLink href={KEY_PAGES.groq} label={t.openGroq} />
        </Step>
        <Step n={2}><p>{t.keyStep2}</p></Step>
        <Step n={3}><p>{t.keyStep3}</p></Step>
      </ol>
      <div className="mt-4"><KeyField provider="groq" label={t.groqKeyLabel} /></div>

      <OrnamentRule className="my-5" />

      <details className="group" open={!!gemini}>
        <summary className="cursor-pointer list-none font-semibold marker:hidden">
          <span className="underline decoration-line-strong underline-offset-4 group-open:no-underline">{t.videoKeyTitle}</span>
        </summary>
        <p className="mt-2 text-sm text-fg-muted text-pretty">{t.videoKeyBody}</p>
        <p className="mt-3 text-sm">{t.videoKeyStep}</p>
        <OpenLink href={KEY_PAGES.gemini} label={t.openGoogle} />
        <div className="mt-4"><KeyField provider="gemini" label={t.geminiKeyLabel} /></div>
      </details>

      <p className="mt-6 text-xs text-fg-muted">{t.keysPrivacy}</p>
    </Sheet>
  )
}
