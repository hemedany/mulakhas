import { useState } from 'react'
import { Pattern } from '@/brand/Ornament'
import { useEngine, useOwnKeys, usePrefs } from '@/app/engine-hooks'
import { LANGS, LANG_NAMES, THEMES, type Theme } from '@/engine'
import type { PresetId } from '@/engine/presets'
import { useT } from '@/i18n/i18n'
import { AppHeader } from './AppHeader'
import { ChoiceList } from './ChoiceList'
import { EmptyState } from './EmptyState'
import { HistoryList } from './HistoryList'
import { KeySheet } from './KeySheet'
import { Sheet } from './Sheet'

type OpenSheet = 'history' | 'language' | 'settings' | 'keys' | null

export function MainScreen() {
  const { prefs } = useEngine()
  const { uiLang, theme } = usePrefs()
  const t = useT()
  const [sheet, setSheet] = useState<OpenSheet>(null)
  const [picked, setPicked] = useState<PresetId | null>(null)
  const ownKeys = useOwnKeys()
  // Files chosen before a Groq key was connected wait here; the Thread takes them in ticket 04.
  const [, setWaitingFiles] = useState<File[]>([])
  const close = () => setSheet(null)
  const addFiles = (files: File[]) => {
    setWaitingFiles(w => [...w, ...files])
    if (!ownKeys.groq) setSheet('keys')
  }
  const themeLabel: Record<Theme, string> = { system: t.themeSystem, light: t.themeLight, dark: t.themeDark }

  return (
    <div className="flex h-dvh flex-col bg-bg">
      <AppHeader onHistory={() => setSheet('history')} onLanguage={() => setSheet('language')} onSettings={() => setSheet('settings')} />
      <div className="relative flex min-h-0 flex-1 flex-col">
        {/* Outside the scroller so it stays put. Phones: fades down the page. Desktop: fills the margins. */}
        <Pattern className="opacity-[0.07] [mask-image:linear-gradient(to_bottom,black,transparent_70%)] lg:opacity-[0.09] lg:[mask-image:none]" />
        <main aria-label={t.mainLabel} className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <EmptyState picked={picked} onPick={setPicked} onAddFiles={addFiles} onAddText={() => {}} />
        </main>
      </div>

      <Sheet open={sheet === 'history'} onClose={close} title={t.historyTitle} closeLabel={t.close}>
        <HistoryList />
      </Sheet>
      <Sheet open={sheet === 'language'} onClose={close} title={t.language} closeLabel={t.close}>
        <ChoiceList label={t.language} value={uiLang} onChange={l => { prefs.set({ uiLang: l }); close() }}
          options={LANGS.map(l => ({ value: l, label: LANG_NAMES[l], lang: l }))} />
      </Sheet>
      <Sheet open={sheet === 'settings'} onClose={close} title={t.settings} closeLabel={t.close}>
        <h3 className="mb-1 text-sm font-semibold text-fg-muted">{t.keysTitle}</h3>
        <div className="divide-y divide-line">
          {([['groq', t.groqKeyLabel], ['gemini', t.geminiKeyLabel]] as const).map(([provider, label]) => (
            <div key={provider} className="flex h-13 items-center justify-between gap-3">
              <span>
                <span className="block">{label}</span>
                <span className="block text-xs text-fg-muted">{ownKeys[provider] ? t.connected : t.notConnected}</span>
              </span>
              <button type="button" onClick={() => setSheet('keys')} className="h-9 rounded-full px-3 text-sm font-medium text-accent">{t.change}</button>
            </div>
          ))}
        </div>
        <h3 className="mt-6 mb-1 text-sm font-semibold text-fg-muted">{t.theme}</h3>
        <ChoiceList label={t.theme} value={theme} onChange={th => prefs.set({ theme: th })}
          options={THEMES.map(th => ({ value: th, label: themeLabel[th] }))} />
      </Sheet>
      <KeySheet open={sheet === 'keys'} onClose={close} />
    </div>
  )
}
