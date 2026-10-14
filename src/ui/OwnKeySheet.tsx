import { ArrowSquareOutIcon, CaretDownIcon, CheckCircleIcon } from '@phosphor-icons/react'
import { useId, useState, type ReactNode } from 'react'
import { OrnamentRule, StarBadge } from '@/brand/Ornament'
import { useEngine, useOwnKeys, usePrefs } from '@/app/engine-hooks'
import { PROVIDER_INFO, type ConnectOutcome, type Provider } from '@/engine'
import { useT } from '@/i18n/i18n'
import type { Strings } from '@/i18n/strings'
import { Sheet } from './Sheet'

/** Shows only the first and last few characters, enough to recognise a key without exposing it. */
function masked(key: string) {
  return key.length <= 10 ? '••••' : `${key.slice(0, 4)}…${key.slice(-4)}`
}

type Failure = Extract<ConnectOutcome, { ok: false }>['reason']
const failureMessage = (t: Strings, provider: Provider): Record<Failure, string> => ({
  empty: t.keyEmpty,
  rejected: t.keyRejected,
  busy: t.keyBusy(PROVIDER_INFO[provider].name),
  unreachable: t.keyUnreachable(PROVIDER_INFO[provider].name),
})

function Step({ n, children }: { n: number; children: ReactNode }) {
  const { uiLang } = usePrefs()
  return (
    <li className="flex gap-3">
      <StarBadge n={n} lang={uiLang} />
      <div className="min-w-0 flex-1 pt-1">{children}</div>
    </li>
  )
}

function KeyPageLink({ provider }: { provider: Provider }) {
  const t = useT()
  return (
    <a href={PROVIDER_INFO[provider].keyPage} target="_blank" rel="noopener noreferrer"
      className="mt-2 inline-flex h-10 items-center gap-1.5 rounded-full border border-line px-4 text-sm font-medium transition-[border-color,scale] duration-(--duration-press) ease-snappy hover:border-line-strong motion-safe:active:scale-[0.97]">
      {t.openKeyPage[provider]}
      <ArrowSquareOutIcon size={16} className="rtl:-scale-x-100" />
    </a>
  )
}

/** Paste a key, check it with its provider, and say what happened where the user is looking. */
function KeyField({ provider }: { provider: Provider }) {
  const { keys } = useEngine()
  const current = useOwnKeys()[provider]
  const t = useT()
  const inputId = useId()
  const [value, setValue] = useState('')
  const [editing, setEditing] = useState(!current)
  const [busy, setBusy] = useState(false)
  const [outcome, setOutcome] = useState<ConnectOutcome | null>(null)
  const label = t.keyLabel[provider]
  const showForm = !current || editing

  // One live region outside the form, so a success is announced even though the form goes away.
  const announcement = outcome
    ? outcome.ok ? `${label}: ${t.connected}` : failureMessage(t, provider)[outcome.reason]
    : ''

  return (
    <div>
      {showForm ? (
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
              placeholder={PROVIDER_INFO[provider].keyHint}
              aria-invalid={!!outcome && !outcome.ok}
              aria-describedby={`${inputId}-status`}
              className="h-12 min-w-0 flex-1 rounded-control border border-line bg-sunken px-3.5 placeholder:text-fg-subtle focus:border-accent focus:outline-none aria-invalid:border-danger"
            />
            <button type="submit" disabled={busy}
              className="h-12 shrink-0 rounded-control bg-accent hover:bg-accent-strong px-5 font-medium text-on-accent transition-[background-color,scale,opacity] duration-(--duration-press) ease-snappy motion-safe:active:scale-[0.97] disabled:opacity-60">
              {busy ? t.checking : t.connect}
            </button>
          </div>
        </form>
      ) : (
        <div className="flex items-center justify-between gap-3 rounded-control border border-line bg-sunken px-3.5 py-2.5">
          <span className="flex min-w-0 items-center gap-2">
            <CheckCircleIcon size={20} weight="fill" className="shrink-0 text-ornament" />
            <span className="min-w-0">
              <span className="block text-sm font-medium">{label}: {t.connected}</span>
              <span className="block truncate text-xs text-fg-muted" dir="ltr">{masked(current!)}</span>
            </span>
          </span>
          <span className="flex shrink-0 gap-1">
            <button type="button" onClick={() => { setEditing(true); setOutcome(null) }} className="h-9 rounded-full px-3 text-sm font-medium text-accent transition-transform duration-(--duration-press) ease-snappy motion-safe:active:scale-[0.97]">{t.change}</button>
            <button type="button" onClick={() => { keys.remove(provider); setOutcome(null) }} className="h-9 rounded-full px-3 text-sm font-medium text-fg-muted transition-transform duration-(--duration-press) ease-snappy motion-safe:active:scale-[0.97]">{t.remove}</button>
          </span>
        </div>
      )}
      <p id={`${inputId}-status`} role="status" aria-live="polite"
        className={`mt-1.5 min-h-5 text-sm ${outcome?.ok ? 'sr-only' : 'text-danger'}`}>
        {announcement}
      </p>
    </div>
  )
}

/** The Own-key sheet: Groq is required to hear Voice notes; a Gemini key optionally lets Mulakhas watch Videos. */
export function OwnKeySheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT()
  const { gemini } = useOwnKeys()
  // Starts open when a Gemini key exists, then follows the user; removing the key must not snap it shut.
  const [videoOpen, setVideoOpen] = useState(!!gemini)

  return (
    <Sheet open={open} onClose={onClose} title={t.keySheetTitle} closeLabel={t.close}>
      <p className="text-fg-muted text-pretty">{t.keyIntro}</p>
      <ol className="mt-5 space-y-4">
        <Step n={1}>
          <p>{t.keyStep1}</p>
          <KeyPageLink provider="groq" />
        </Step>
        <Step n={2}><p>{t.keyStep2}</p></Step>
        <Step n={3}><p>{t.keyStep3}</p></Step>
      </ol>
      <div className="mt-4"><KeyField provider="groq" /></div>

      <OrnamentRule className="my-5" />

      <details className="group" open={videoOpen} onToggle={e => setVideoOpen(e.currentTarget.open)}>
        <summary className="flex cursor-pointer list-none items-center gap-1.5 font-semibold">
          <span className="underline decoration-line-strong underline-offset-4 group-open:no-underline">{t.videoKeyTitle}</span>
          <CaretDownIcon size={14} weight="bold" className="shrink-0 text-fg-muted transition-transform duration-(--duration-ui) ease-snappy group-open:rotate-180" />
        </summary>
        <div className="disclosed">
          <p className="mt-2 text-sm text-fg-muted text-pretty">{t.videoKeyBody}</p>
          <p className="mt-3 text-sm">{t.videoKeyStep}</p>
          <KeyPageLink provider="gemini" />
          <div className="mt-4"><KeyField provider="gemini" /></div>
        </div>
      </details>

      <p className="mt-6 text-xs text-fg-muted">{t.keysPrivacy}</p>
    </Sheet>
  )
}
