import { ArrowCounterClockwiseIcon, ChatTextIcon, MicrophoneIcon, UploadSimpleIcon } from '@phosphor-icons/react'
import { useEffect, useRef, useState } from 'react'
import { PageBackdrop } from '@/brand/backdrops'
import { Pattern } from '@/brand/Ornament'
import { useEngine, useIsDesktop, useOwnKeys, usePrefs, useThread } from '@/app/engine-hooks'
import { LANGS, LANG_NAMES, PROVIDERS, THEMES, type Theme } from '@/engine'
import { useT } from '@/i18n/i18n'
import { AppHeader } from './AppHeader'
import { ChoiceList } from './ChoiceList'
import { Composer } from './Composer'
import { EmptyState } from './EmptyState'
import { HistorySheet } from './HistorySheet'
import { MEDIA_ACCEPT } from './media'
import { scrollBehavior } from './motion'
import { OwnKeySheet } from './OwnKeySheet'
import { ResultChip, ResultInThread, ResultSheet } from './result/ResultViews'
import { Sheet } from './Sheet'
import { MessageOptions } from './thread/MessageOptions'
import { MessageRow } from './thread/MessageRow'
import { WritingStatus } from './thread/WritingStatus'
import { MakeoverSheet } from './tutorial/Makeover'
import { Tutorial } from './tutorial/Tutorial'
import { useAddMessages } from './useAddMessages'
import { useArrivals } from './arrivals'

/** A removed Message goes once its fade ends; this long at most, should no transition run. */
const MOST_LEAVE_MS = 600

type OpenSheet = 'history' | 'language' | 'settings' | 'keys' | 'add' | 'result' | 'start-over' | 'tutorial' | 'makeover' | null

export function MainScreen() {
  const { prefs, thread, sharedIn } = useEngine()
  const { uiLang, theme, showReliability } = usePrefs()
  const { messages, result, writing, draft, unsaved } = useThread()
  const ownKeys = useOwnKeys()
  const desktop = useIsDesktop()
  const t = useT()
  // A first Share-in with no Groq key yet asks for the key straight away, as adding files here does;
  // someone who used Mulakhas before is told what changed first, and asked for the key after.
  const needKeyFirst = sharedIn.count > 0 && !ownKeys.groq
  const [sheet, setSheet] = useState<OpenSheet>(() => {
    const welcome = prefs.welcome()
    if (welcome === 'makeover') return 'makeover'
    if (needKeyFirst) return 'keys'
    return welcome
  })
  const welcomed = () => {
    prefs.welcomed()
    setSheet(sheet === 'makeover' && needKeyFirst && !ownKeys.groq ? 'keys' : null)
  }
  // The service worker sends the app here with ?share-failed when it couldn't read a share.
  const [shareFailed] = useState(() => new URLSearchParams(location.search).has('share-failed'))
  useEffect(() => { if (shareFailed) history.replaceState(null, '', location.pathname) }, [shareFailed])
  const [optionsFor, setOptionsFor] = useState<string | null>(null)
  // Desktop: the Result whose bar was switched back to a Request, to write a new one. A new Result asks Follow-ups again.
  const [rewritingFrom, setRewritingFrom] = useState<string | null>(null)
  const close = () => setSheet(null)
  const { picker, choose, onPicked, addText, newTextId, setNewTextId, dropZone, dragging, storageFailed } = useAddMessages({ onNeedKey: () => setSheet('keys') })
  const themeLabel: Record<Theme, string> = { system: t.themeSystem, light: t.themeLight, dark: t.themeDark }

  // Whatever lands at the end of the Thread (added files, a Share-in) scrolls into view.
  const list = useRef<HTMLOListElement>(null)
  const lastId = messages.at(-1)?.id
  const shownLast = useRef(lastId)
  useEffect(() => {
    if (lastId && lastId !== shownLast.current) list.current?.lastElementChild?.scrollIntoView({ block: 'nearest', behavior: scrollBehavior() })
    shownLast.current = lastId
  }, [lastId])

  const problem = storageFailed || sharedIn.failed ? t.storageFull : shareFailed ? t.shareFailed : unsaved ? t.notSaved : null

  const summarize = () => { void thread.summarize(draft).catch(() => {}) }
  // On phones a fresh Result rises as a sheet; on desktop it appears in the Thread.
  const lastResult = useRef(result?.id)
  // What was already there when the app opened appears as it is; what arrives later (Share-ins included) rises into place.
  const messageArrives = useArrivals(messages.map(m => m.id), sharedIn.ids)
  const resultArrives = useArrivals(result ? [result.id] : [])
  const [startedEmpty] = useState(messages.length === 0)
  // A removed Message fades out first, then goes.
  const [leaving, setLeaving] = useState<ReadonlySet<string>>(new Set())
  const gone = (id: string) => {
    setLeaving(l => { const rest = new Set(l); rest.delete(id); return rest })
    void thread.remove(id)
  }
  const removeMessage = (id: string) => {
    setLeaving(l => new Set(l).add(id))
    setTimeout(() => gone(id), MOST_LEAVE_MS)
  }
  // On phones the Result sheet's own khatam turns once, the first time a new Result's sheet opens.
  const [turnedFor, setTurnedFor] = useState(result?.id)
  useEffect(() => {
    if (result && result.id !== lastResult.current && !desktop) setSheet('result')
    lastResult.current = result?.id
  }, [result, desktop])

  return (
    <div className="relative flex h-dvh flex-col bg-bg" {...dropZone}>
      <a href="#main" className="sr-only rounded-full bg-accent px-4 py-2 font-medium text-on-accent focus:not-sr-only focus:absolute focus:start-3 focus:top-3 focus:z-20">{t.skipToMain}</a>
      <AppHeader onOpen={setSheet} />
      <input ref={picker} type="file" multiple accept={MEDIA_ACCEPT} hidden
        onChange={e => { onPicked(e.target.files); e.target.value = '' }} />

      <div className="relative flex min-h-0 flex-1 flex-col">
        {/* Outside the scroller so it stays put. Phones: fades down the page. Desktop: fills the margins. */}
        <PageBackdrop tile={<Pattern className="opacity-[0.07] [mask-image:linear-gradient(to_bottom,black,transparent_70%)] lg:opacity-[0.09] lg:[mask-image:none]" />} />
        <main id="main" tabIndex={-1} aria-label={t.mainLabel} className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain focus:outline-none">
          {problem && (
            <p role="alert" className="mx-auto mt-3 max-w-2xl rounded-control border border-danger/40 bg-surface px-4 py-3 text-sm text-danger">{problem}</p>
          )}
          {messages.length === 0 ? (
            <EmptyState arrives={!startedEmpty} picked={draft.mode === 'exact' ? 'exact' : draft.preset}
              // Exact words is a Mode, not a preset; every other preset is a kind of Summary.
              onPick={p => void thread.setDraft(p === 'exact' ? { ...draft, mode: 'exact', preset: null } : { ...draft, mode: 'summary', preset: p })}
              onChooseFiles={choose} onAddText={() => void addText()} />
          ) : (
            <div className="flex min-h-full flex-col">
              <div className="mx-auto w-full flex-1 px-3 py-5 lg:max-w-3xl lg:border-x lg:border-ornament/30 lg:bg-bg lg:px-12 lg:py-10">
                <div className="mx-auto max-w-2xl">
                  <ol ref={list} className="space-y-3">
                    {messages.map((m, i) => (
                      <MessageRow key={m.id} message={m} n={i + 1} isNewText={m.id === newTextId}
                        arrives={messageArrives(m.id)} leaving={leaving.has(m.id)} onLeft={() => gone(m.id)}
                        onOptions={() => setOptionsFor(m.id)} onConnectKey={() => setSheet('keys')} />
                    ))}
                  </ol>
                  <WritingStatus onRetry={summarize} onConnectKey={() => setSheet('keys')} />
                  {result && writing.state === 'idle' && (desktop
                    ? <ResultInThread result={result} arrives={resultArrives(result.id)} onConnectKey={() => setSheet('keys')}
                        onWriteAgain={rewritingFrom === result.id ? undefined : () => setRewritingFrom(result.id)} />
                    : <ResultChip result={result} arrives={resultArrives(result.id)} onOpen={() => setSheet('result')} />)}
                </div>
              </div>
            </div>
          )}
        </main>
        {messages.length > 0 && (
          <Composer onAdd={() => setSheet('add')} onSummarize={summarize} busy={writing.state === 'listening' || writing.state === 'writing'}
            // On desktop the Result is in the Thread, so once there is one the composer asks Follow-ups about it.
            askingFollowUps={desktop && !!result && writing.state === 'idle' && rewritingFrom !== result.id} />
        )}
      </div>

      {dragging && (
        <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center bg-scrim">
          <p className="flex items-center gap-2 rounded-full bg-surface px-6 py-3 text-lg font-semibold shadow-floating"><UploadSimpleIcon size={22} className="text-accent" />{t.dropHere}</p>
        </div>
      )}

      <ResultSheet result={result} open={sheet === 'result'} turnMark={!!result && result.id !== turnedFor}
        onClose={() => { setTurnedFor(result?.id); close() }} onConnectKey={() => setSheet('keys')} />
      <Sheet open={sheet === 'add'} onClose={close} title={t.addSheetTitle} closeLabel={t.close}>
        <div className="divide-y divide-line">
          <button type="button" onClick={() => { close(); choose() }} className="flex h-13 w-full items-center gap-3 text-start font-medium transition-opacity duration-(--duration-press) ease-snappy active:opacity-60">
            <MicrophoneIcon size={22} className="text-accent" />{t.addMessages}
          </button>
          <button type="button" onClick={() => { close(); void addText() }} className="flex h-13 w-full items-center gap-3 text-start font-medium transition-opacity duration-(--duration-press) ease-snappy active:opacity-60">
            <ChatTextIcon size={22} className="text-accent" />{t.addTextMessage}
          </button>
          <button type="button" onClick={() => setSheet('start-over')} className="flex h-13 w-full items-center gap-3 text-start font-medium text-danger transition-opacity duration-(--duration-press) ease-snappy active:opacity-60">
            <ArrowCounterClockwiseIcon size={22} />{t.startOver}
          </button>
        </div>
      </Sheet>
      <Sheet open={sheet === 'start-over'} onClose={close} title={t.startOver} closeLabel={t.close}>
        <p className="text-fg-muted">{t.startOverConfirm}</p>
        <div className="mt-5 flex gap-2">
          <button type="button" onClick={() => { close(); void thread.startOver() }}
            className="h-12 flex-1 rounded-full bg-danger px-4 font-medium text-on-danger transition-transform duration-(--duration-press) ease-snappy motion-safe:active:scale-[0.98]">{t.confirmStartOver}</button>
          <button type="button" onClick={close}
            className="h-12 flex-1 rounded-full border border-line px-4 font-medium transition-transform duration-(--duration-press) ease-snappy motion-safe:active:scale-[0.98]">{t.cancel}</button>
        </div>
      </Sheet>
      <MessageOptions id={optionsFor} onClose={() => setOptionsFor(null)} onTextAdded={setNewTextId} onRemove={removeMessage} />
      <HistorySheet open={sheet === 'history'} onClose={close} />
      <Tutorial open={sheet === 'tutorial'} onClose={welcomed} />
      <MakeoverSheet open={sheet === 'makeover'} onClose={welcomed} />
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
              <button type="button" onClick={() => setSheet('keys')} className="h-9 rounded-full px-3 text-sm font-medium text-accent transition-transform duration-(--duration-press) ease-snappy motion-safe:active:scale-[0.97]">
                {ownKeys[provider] ? t.change : t.connect}
              </button>
            </div>
          ))}
        </div>
        <h3 className="mt-6 mb-1 text-sm font-semibold text-fg-muted">{t.resultsTitle}</h3>
        <label className="flex h-13 items-center justify-between gap-3">
          <span>{t.settingReliability}</span>
          <input type="checkbox" checked={showReliability} onChange={e => prefs.set({ showReliability: e.target.checked })}
            className="size-5 accent-(--accent)" />
        </label>
        <h3 className="mt-6 mb-1 text-sm font-semibold text-fg-muted">{t.theme}</h3>
        <ChoiceList label={t.theme} value={theme} onChange={th => prefs.set({ theme: th })}
          options={THEMES.map(th => ({ value: th, label: themeLabel[th] }))} />
      </Sheet>
      <OwnKeySheet open={sheet === 'keys'} onClose={close} />
    </div>
  )
}
