import { ChatTextIcon, MicrophoneIcon } from '@phosphor-icons/react'
import { useRef, useState } from 'react'
import { Pattern } from '@/brand/Ornament'
import { useEngine, useOwnKeys, usePrefs, useThread } from '@/app/engine-hooks'
import { LANGS, LANG_NAMES, PROVIDERS, THEMES, type Mode, type Theme } from '@/engine'
import type { PresetId } from '@/engine/presets'
import { useT } from '@/i18n/i18n'
import { AppHeader } from './AppHeader'
import { ChoiceList } from './ChoiceList'
import { Composer } from './Composer'
import { EmptyState } from './EmptyState'
import { HistoryList } from './HistoryList'
import { MEDIA_ACCEPT } from './media'
import { OwnKeySheet } from './OwnKeySheet'
import { Sheet } from './Sheet'
import { MessageOptions } from './thread/MessageOptions'
import { MessageRow } from './thread/MessageRow'

type OpenSheet = 'history' | 'language' | 'settings' | 'keys' | 'add' | null

export function MainScreen() {
  const { prefs, thread } = useEngine()
  const { uiLang, theme } = usePrefs()
  const { messages } = useThread()
  const ownKeys = useOwnKeys()
  const t = useT()
  const [sheet, setSheet] = useState<OpenSheet>(null)
  const [optionsFor, setOptionsFor] = useState<string | null>(null)
  const [focusId, setFocusId] = useState<string | null>(null)
  const [preset, setPreset] = useState<PresetId | null>(null)
  const [mode, setMode] = useState<Mode>('summary')
  const [request, setRequest] = useState('')
  const picker = useRef<HTMLInputElement>(null)
  const close = () => setSheet(null)
  const themeLabel: Record<Theme, string> = { system: t.themeSystem, light: t.themeLight, dark: t.themeDark }

  const chooseFiles = () => { close(); picker.current?.click() }
  const addFiles = async (files: File[]) => {
    await thread.addFiles(files)
    // The Messages stay in the Thread; they are heard as soon as a key is connected.
    if (!ownKeys.groq) setSheet('keys')
  }
  const addText = async (at = messages.length) => { close(); setFocusId(await thread.addText(at)) }

  return (
    <div className="flex h-dvh flex-col bg-bg">
      <AppHeader onHistory={() => setSheet('history')} onLanguage={() => setSheet('language')} onSettings={() => setSheet('settings')} />
      <input ref={picker} type="file" multiple accept={MEDIA_ACCEPT} hidden
        onChange={e => { const files = [...(e.target.files ?? [])]; e.target.value = ''; if (files.length) void addFiles(files) }} />

      <div className="relative flex min-h-0 flex-1 flex-col">
        {/* Outside the scroller so it stays put. Phones: fades down the page. Desktop: fills the margins. */}
        <Pattern className="opacity-[0.07] [mask-image:linear-gradient(to_bottom,black,transparent_70%)] lg:opacity-[0.09] lg:[mask-image:none]" />
        <main aria-label={t.mainLabel} className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {messages.length === 0 ? (
            <EmptyState picked={preset} onPick={setPreset} onChooseFiles={chooseFiles} onAddText={() => addText()} />
          ) : (
            <div className="flex min-h-full flex-col">
              <div className="mx-auto w-full flex-1 px-3 py-5 lg:max-w-3xl lg:border-x lg:border-ornament/30 lg:bg-bg lg:px-12 lg:py-10">
                <ol className="mx-auto max-w-2xl space-y-3">
                  {messages.map((m, i) => (
                    <MessageRow key={m.id} message={m} n={i + 1} focusNew={m.id === focusId} onOptions={() => setOptionsFor(m.id)} />
                  ))}
                </ol>
              </div>
            </div>
          )}
        </main>
        {messages.length > 0 && (
          <Composer mode={mode} onMode={setMode} preset={preset} onPreset={setPreset} request={request} onRequest={setRequest}
            onAdd={() => setSheet('add')} onSummarize={() => {}} canSummarize={false} />
        )}
      </div>

      <Sheet open={sheet === 'add'} onClose={close} title={t.addSheetTitle} closeLabel={t.close}>
        <div className="divide-y divide-line">
          <button type="button" onClick={chooseFiles} className="flex h-14 w-full items-center gap-3 text-start font-medium">
            <MicrophoneIcon size={22} className="text-ornament" />{t.addMessages}
          </button>
          <button type="button" onClick={() => addText()} className="flex h-14 w-full items-center gap-3 text-start font-medium">
            <ChatTextIcon size={22} className="text-ornament" />{t.addTextMessage}
          </button>
        </div>
      </Sheet>
      <MessageOptions id={optionsFor} onClose={() => setOptionsFor(null)} onTextAdded={setFocusId} />
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
          {PROVIDERS.map(provider => (
            <div key={provider} className="flex h-13 items-center justify-between gap-3">
              <span>
                <span className="block">{t.keyLabel[provider]}</span>
                <span className="block text-xs text-fg-muted">{ownKeys[provider] ? t.connected : t.notConnected}</span>
              </span>
              <button type="button" onClick={() => setSheet('keys')} className="h-9 rounded-full px-3 text-sm font-medium text-accent">
                {ownKeys[provider] ? t.change : t.connect}
              </button>
            </div>
          ))}
        </div>
        <h3 className="mt-6 mb-1 text-sm font-semibold text-fg-muted">{t.theme}</h3>
        <ChoiceList label={t.theme} value={theme} onChange={th => prefs.set({ theme: th })}
          options={THEMES.map(th => ({ value: th, label: themeLabel[th] }))} />
      </Sheet>
      <OwnKeySheet open={sheet === 'keys'} onClose={close} />
    </div>
  )
}
