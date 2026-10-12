import { useEffect, useState, type ReactNode } from 'react'
import { browserDeps, createEngine, pickLang, RTL_LANGS, type Engine } from '@/engine'
import { STRINGS } from '@/i18n/strings'
import { EngineContext } from './engine-hooks'

export function EngineProvider({ children }: { children: ReactNode }) {
  const [engine, setEngine] = useState<Engine | null>(null)
  const [failure, setFailure] = useState<Error | null>(null)

  useEffect(() => {
    createEngine(browserDeps()).then(setEngine, setFailure)
  }, [])

  if (failure) {
    // Storage can be unavailable (private mode on some browsers, blocked site data), so the
    // saved interface language is unreachable too: fall back to the browser's language.
    const lang = pickLang(navigator.languages)
    return (
      <main lang={lang} dir={RTL_LANGS.has(lang) ? 'rtl' : 'ltr'} className="mx-auto max-w-md p-6 text-sm">
        <p>{STRINGS[lang].storageUnavailable}</p>
        <p className="mt-2 opacity-60">{failure.message}</p>
      </main>
    )
  }
  if (!engine) return null
  return <EngineContext value={engine}>{children}</EngineContext>
}
