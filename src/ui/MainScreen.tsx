import { ArrowCounterClockwiseIcon, CaretDownIcon, ChatTextIcon, ChatsIcon, MicrophoneIcon, UploadSimpleIcon } from '@phosphor-icons/react'
import { useEffect, useRef, useState } from 'react'
import { Pattern } from '@/brand/Ornament'
import { useEngine, useOwnKeys, usePrefs, useThread } from '@/app/engine-hooks'
import { LANGS, LANG_NAMES, PROVIDERS, THEMES, type Removed, type Theme } from '@/engine'
import { useT } from '@/i18n/i18n'
import { AppHeader } from './AppHeader'
import { ChoiceList } from './ChoiceList'
import { Composer } from './Composer'
import { EmptyState } from './EmptyState'
import { HistorySheet } from './HistorySheet'
import { MEDIA_ACCEPT } from './media'
import { scrollBehavior } from './motion'
import { OwnKeySheet } from './OwnKeySheet'
import { ResultInThread } from './result/ResultViews'
import { Sheet } from './Sheet'
import { useFlip } from './flip'
import { UndoBar } from './thread/UndoBar'
import { InsertHere, MessageRow } from './thread/MessageRow'
import { WritingStatus } from './thread/WritingStatus'
import { MakeoverSheet } from './tutorial/Makeover'
import { Tutorial } from './tutorial/Tutorial'
import { useAddMessages } from './useAddMessages'
import { useArrivals } from './arrivals'

/** A removed Message goes once its fade ends; this long at most, should no transition run. */
const MOST_LEAVE_MS = 600

type OpenSheet = 'history' | 'language' | 'settings' | 'keys' | 'add' | 'start-over' | 'tutorial' | 'makeover' | null

/** Above a Result: how many Messages it was made from, and a button to show or hide them. */
function MessagesBar({ count, shown, onToggle }: { count: number; shown: boolean; onToggle: () => void }) {
  const t = useT()
  return (
    <button type="button" aria-expanded={shown} onClick={onToggle}
      className="flex w-full items-center gap-2.5 rounded-card border border-line bg-surface px-3.5 py-2.5 text-start text-sm shadow-raised transition-[background-color,scale] duration-(--duration-press) ease-snappy hover:bg-sunken/60 motion-safe:active:scale-[0.99]">
      <ChatsIcon size={18} className="shrink-0 text-ornament" />
      <span className="flex-1 font-medium">{t.messagesCount(count)}</span>
      <span className="inline-flex items-center gap-1 font-semibold text-accent">
        {shown ? t.hideMessages : t.showMessages}
        <CaretDownIcon size={14} weight="bold" className={`transition-transform duration-(--duration-ui) ease-snappy ${shown ? 'rotate-180' : ''}`} />
      </span>
    </button>
  )
}

export function MainScreen() {
  const { prefs, thread, sharedIn } = useEngine()
  const { uiLang, theme, showReliability } = usePrefs()
  const { messages, result, writing, draft, unsaved } = useThread()
  const ownKeys = useOwnKeys()
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
  // Desktop: the Result whose bar was switched back to a Request, to write a new one. A new Result asks Follow-ups again.
  const [rewritingFrom, setRewritingFrom] = useState<string | null>(null)
  const close = () => setSheet(null)
  const { picker, choose, onPicked, addText, newTextId, setNewTextId, dropZone, dragging, storageFailed } = useAddMessages({ onNeedKey: () => setSheet('keys') })
  const themeLabel: Record<Theme, string> = { system: t.themeSystem, light: t.themeLight, dark: t.themeDark }

  // Whatever lands at the end of the Thread (added files, a Share-in) scrolls into view; a Message moved to the end stays put.
  const list = useRef<HTMLOListElement>(null)
  const lastId = messages.at(-1)?.id
  const shownLast = useRef({ id: lastId, count: messages.length })
  useEffect(() => {
    const shown = shownLast.current
    if (lastId && lastId !== shown.id && messages.length > shown.count) list.current?.lastElementChild?.scrollIntoView({ block: 'nearest', behavior: scrollBehavior() })
    shownLast.current = { id: lastId, count: messages.length }
  }, [lastId, messages.length])
  // Moving, inserting, removing and Undo: the other Messages glide to their new places.
  const flip = useFlip(list, messages.map(m => m.id).join())

  const problem = storageFailed || sharedIn.failed ? t.storageFull : shareFailed ? t.shareFailed : unsaved ? t.notSaved : null

  const summarize = () => { void thread.summarize(draft).catch(() => {}) }
  // What was already there when the app opened appears as it is; what arrives later (Share-ins included) rises into place.
  const messageArrives = useArrivals(messages.map(m => m.id), sharedIn.ids)
  const resultArrives = useArrivals(result ? [result.id] : [])
  // The composer rises in when a Thread starts, not when the app opens on one.
  const composerArrives = useArrivals(messages.slice(0, 1).map(m => m.id))
  const [startedEmpty] = useState(messages.length === 0)
  // A removed Message fades out first, then goes; the last one removed can be brought back.
  const [leaving, setLeaving] = useState<ReadonlySet<string>>(new Set())
  // Keyed afresh for each removal, so removing the same Message again restarts the bar.
  const [undo, setUndo] = useState<{ removed: Removed; key: number } | null>(null)
  const removals = useRef(0)
  const removing = useRef(new Set<string>())
  // Called when the fade ends, and again by a timer in case it never does: only the first goes on.
  const gone = async (id: string) => {
    if (!removing.current.delete(id)) return
    flip.measure()
    const removed = await thread.remove(id)
    setLeaving(l => { const rest = new Set(l); rest.delete(id); return rest })
    if (removed) setUndo({ removed, key: ++removals.current })
  }
  const removeMessage = (id: string) => {
    removing.current.add(id)
    setLeaving(l => new Set(l).add(id))
    setTimeout(() => void gone(id), MOST_LEAVE_MS)
  }
  const moveMessage = (id: string, by: number) => { flip.measure(); void thread.moveBy(id, by) }
  const insertBefore = async (id: string) => { flip.measure(); setNewTextId(await thread.addTextNear(id, 'above')) }
  const restore = (removed: Removed) => { flip.measure(); void thread.restore(removed) }
  // Once there is a Result it is the point: the Messages fold away above it until asked for, and
  // come back while a new Result is being asked for from them.
  const hasResult = !!result && writing.state === 'idle'
  const rewriting = hasResult && rewritingFrom === result.id
  const [shownFor, setShownFor] = useState<string | null>(null)
  const messagesShown = !hasResult || rewriting || shownFor === result.id

  return (
    <div className="relative flex h-dvh flex-col bg-bg" {...dropZone}>
      <a href="#main" className="sr-only rounded-full bg-accent px-4 py-2 font-medium text-on-accent focus:not-sr-only focus:absolute focus:start-3 focus:top-3 focus:z-20">{t.skipToMain}</a>
      <AppHeader onOpen={setSheet} onNew={messages.length > 0 ? () => setSheet('start-over') : undefined} />
      <input ref={picker} type="file" multiple accept={MEDIA_ACCEPT} hidden
        onChange={e => { onPicked(e.target.files); e.target.value = '' }} />

      <div className="relative flex min-h-0 flex-1 flex-col">
        {/* Outside the scroller so it stays put. Phones: fades down the page. Desktop: fills the margins. */}
        <Pattern className="opacity-[0.07] [mask-image:linear-gradient(to_bottom,black,transparent_70%)] lg:opacity-[0.09] lg:[mask-image:none]" />
        <div className="relative flex min-h-0 flex-1 flex-col">
        <main id="main" tabIndex={-1} aria-label={t.mainLabel} className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain focus:outline-none">
          {problem && (
            <p role="alert" className="arrives mx-auto mt-3 max-w-2xl rounded-control border border-danger/40 bg-surface px-4 py-3 text-sm text-danger">{problem}</p>
          )}
          {messages.length === 0 ? (
            <EmptyState arrives={!startedEmpty} onChooseFiles={choose} onAddText={() => void addText()} />
          ) : (
            <div className="flex min-h-full flex-col">
              <div className="mx-auto w-full flex-1 px-3 py-5 lg:max-w-3xl lg:border-x lg:border-ornament/30 lg:bg-bg lg:px-12 lg:py-10">
                <div className="mx-auto max-w-2xl">
                  {hasResult && !rewriting && (
                    <MessagesBar count={messages.length} shown={messagesShown} onToggle={() => setShownFor(messagesShown ? null : result.id)} />
                  )}
                  {messagesShown && (
                  <div className={hasResult ? 'arrives' : undefined}>
                  <ol ref={list} className="list-none">
                    {messages.map((m, i) => (
                      <MessageRow key={m.id} message={m} n={i + 1} isNewText={m.id === newTextId}
                        arrives={messageArrives(m.id)} leaving={leaving.has(m.id)} onLeft={() => void gone(m.id)}
                        onMoveUp={i > 0 ? () => moveMessage(m.id, -1) : undefined}
                        onMoveDown={i < messages.length - 1 ? () => moveMessage(m.id, 1) : undefined}
                        onRemove={() => removeMessage(m.id)} onInsertBefore={() => void insertBefore(m.id)}
                        onConnectKey={() => setSheet('keys')} />
                    ))}
                  </ol>
                  <InsertHere label={t.addTextMessage} onInsert={() => { flip.measure(); void addText() }} />
                  </div>
                  )}
                  <WritingStatus onRetry={summarize} onConnectKey={() => setSheet('keys')} />
                  {hasResult && (
                    <ResultInThread result={result} arrives={resultArrives(result.id)} onConnectKey={() => setSheet('keys')}
                      onWriteAgain={rewriting ? undefined : () => setRewritingFrom(result.id)} />
                  )}
                </div>
              </div>
            </div>
          )}
        </main>
        {undo && <UndoBar key={undo.key} removed={undo.removed} onUndo={restore} onGone={() => setUndo(null)} />}
        </div>
        {messages.length > 0 && (
          <Composer rises={composerArrives(messages[0].id)} onAdd={() => setSheet('add')} onSummarize={summarize} busy={writing.state === 'listening' || writing.state === 'writing'}
            // Once there is a Result, the composer asks Follow-ups about it, until a new one is asked for.
            askingFollowUps={hasResult && !rewriting} />
        )}
      </div>

      {dragging && (
        <div className="fades-in pointer-events-none absolute inset-0 z-10 grid place-items-center bg-scrim">
          <p className="flex items-center gap-2 rounded-full bg-surface px-6 py-3 text-lg font-semibold shadow-floating"><UploadSimpleIcon size={22} className="text-accent" />{t.dropHere}</p>
        </div>
      )}

      <Sheet open={sheet === 'add'} onClose={close} title={t.addSheetTitle} closeLabel={t.close}>
        <div className="divide-y divide-line">
          <button type="button" onClick={() => { close(); choose() }} className="-mx-2 flex h-13 w-[calc(100%+1rem)] items-center gap-3 px-2 text-start font-medium rounded-control transition-[background-color] duration-(--duration-press) ease-snappy hover:bg-sunken/60 active:bg-sunken">
            <MicrophoneIcon size={22} className="text-accent" />{t.addMessages}
          </button>
          <button type="button" onClick={() => { close(); void addText() }} className="-mx-2 flex h-13 w-[calc(100%+1rem)] items-center gap-3 px-2 text-start font-medium rounded-control transition-[background-color] duration-(--duration-press) ease-snappy hover:bg-sunken/60 active:bg-sunken">
            <ChatTextIcon size={22} className="text-accent" />{t.addTextMessage}
          </button>
          <button type="button" onClick={() => setSheet('start-over')} className="-mx-2 flex h-13 w-[calc(100%+1rem)] items-center gap-3 px-2 text-start font-medium text-danger rounded-control transition-[background-color] duration-(--duration-press) ease-snappy hover:bg-sunken/60 active:bg-sunken">
            <ArrowCounterClockwiseIcon size={22} />{t.startOver}
          </button>
        </div>
      </Sheet>
      <Sheet open={sheet === 'start-over'} onClose={close} title={t.startOver} closeLabel={t.close}>
        <p className="text-fg-muted">{t.startOverConfirm}</p>
        <div className="mt-5 flex gap-2">
          <button type="button" onClick={() => { close(); setUndo(null); void thread.startOver() }}
            className="h-12 flex-1 rounded-full bg-danger px-4 font-medium text-on-danger transition-transform duration-(--duration-press) ease-snappy motion-safe:active:scale-[0.98]">{t.confirmStartOver}</button>
          <button type="button" onClick={close}
            className="h-12 flex-1 rounded-full border border-line px-4 font-medium transition-transform duration-(--duration-press) ease-snappy motion-safe:active:scale-[0.98]">{t.cancel}</button>
        </div>
      </Sheet>
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
