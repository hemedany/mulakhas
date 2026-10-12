import { DocumentSync } from '@/app/document-sync'
import { EngineProvider } from '@/app/EngineProvider'
import { useEngine, usePrefs } from '@/app/engine-hooks'
import { HistoryList } from '@/app/HistoryList'
import { LANGS, LANG_NAMES, THEMES, type Lang, type Theme } from '@/engine'
import { useT } from '@/i18n/i18n'

// Foundation shell (ticket 01). The real main screen is chosen in ticket 02.
function Shell() {
  const { prefs } = useEngine()
  const { uiLang, theme } = usePrefs()
  const t = useT()
  const themeLabel: Record<Theme, string> = { system: t.themeSystem, light: t.themeLight, dark: t.themeDark }

  return (
    <main className="mx-auto max-w-xl px-4 py-8">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">{t.brand}</h1>
        <div className="flex gap-2 text-sm">
          <label className="sr-only" htmlFor="lang">{t.language}</label>
          <select
            id="lang"
            className="rounded-md border border-line bg-surface px-2 py-1"
            value={uiLang}
            onChange={e => prefs.set({ uiLang: e.target.value as Lang })}
          >
            {LANGS.map(l => <option key={l} value={l}>{LANG_NAMES[l]}</option>)}
          </select>
          <label className="sr-only" htmlFor="theme">{t.theme}</label>
          <select
            id="theme"
            className="rounded-md border border-line bg-surface px-2 py-1"
            value={theme}
            onChange={e => prefs.set({ theme: e.target.value as Theme })}
          >
            {THEMES.map(th => <option key={th} value={th}>{themeLabel[th]}</option>)}
          </select>
        </div>
      </header>
      <section className="mt-8">
        <h2 className="mb-2 text-sm font-medium text-fg-muted">{t.historyTitle}</h2>
        <HistoryList />
      </section>
    </main>
  )
}

export default function App() {
  return (
    <EngineProvider>
      <DocumentSync />
      <Shell />
    </EngineProvider>
  )
}
