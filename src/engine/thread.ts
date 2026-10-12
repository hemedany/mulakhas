// The Thread: the ordered Messages Mulakhas reads together. Saved on the device after every
// change (files included), so nothing is lost when the page reloads, and heard in the
// background as soon as a Groq key is connected.
import { oneAtATime, type DecodeAudio } from './audio'
import type { Db } from './db'
import { GEMINI_MAX_BYTES, WatchError, chooseWatcher, watchVideo, type WatchFailure } from './gemini'
import { hearFile, type PartsHeard } from './hearing'
import type { History, Mode } from './history'
import type { KeysStore } from './keys'
import { observable, type Observable } from './observable'
import type { PrefsStore } from './prefs'
import type { Fetch } from './providers'
import { reliabilityReport, type ReliabilityRow } from './reliability'
import type { Transcript } from './transcript'
import { HearError, transcribe, type HearFailure } from './whisper'
import { WriteError, buildPrompt, canWrite, chooseWriter, titleOf, write, type WriteFailure, type WriteOptions, type Written } from './writer'

export type MediaKind = 'voice' | 'video'
export type HearState = 'waiting' | 'hearing' | 'heard' | 'failed'

export interface MediaMessage {
  id: string
  kind: MediaKind
  name: string
  type: string
  size: number
  lastModified: number
  state: HearState
  failure?: HearFailure
  /** While Groq has asked us to wait: when the next try happens (ms since epoch). */
  retryAt?: number
  /** A long Voice note or Video heard in parts: the parts heard so far, kept until all are heard. */
  parts?: PartsHeard
  /** How many times decoding this file started without finishing (see hearing.ts). */
  decodeTries?: number
  /** A Video Gemini couldn't watch, so only its sound was heard: why. */
  watchFailure?: WatchFailure
  transcript?: Transcript
}

export interface TextMessage {
  id: string
  kind: 'text'
  text: string
}

export type Message = MediaMessage | TextMessage

/** The Result written for this Thread. */
export interface ThreadResult {
  id: string
  createdAt: number
  mode: Mode
  text: string
  /** The writer ran out of room, so the end is missing. */
  cutOff?: boolean
  report: ReliabilityRow[]
}

export type Writing =
  | { state: 'idle' }
  | { state: 'listening' }
  /** `retryAt`: Groq asked us to wait until then before trying again. */
  | { state: 'writing'; retryAt?: number }
  | { state: 'failed'; failure: WriteFailure }

export interface ThreadState {
  messages: Message[]
  result: ThreadResult | null
  writing: Writing
  /** The Request being written, kept so a reload does not lose it. */
  draft: WriteOptions
  /** The last change could not be saved on the device, so closing the app would lose it. */
  unsaved: boolean
}

const EMPTY_DRAFT: WriteOptions = { request: '', mode: 'summary', preset: null }

export interface ThreadStore extends Observable<ThreadState> {
  /**
   * Appends Voice notes and Videos in the order they were sent, and starts hearing them. After a
   * Result, they start a fresh Thread, once the Result is safely in History. `ids`, one per file,
   * makes adding the same files twice harmless: a file whose id is already in the Thread is skipped.
   */
  addFiles(files: File[], ids?: string[]): Promise<void>
  /** Inserts an empty (or given) Text message at a position; returns its id. */
  addText(at: number, text?: string): Promise<string>
  setText(id: string, text: string): Promise<void>
  move(id: string, to: number): Promise<void>
  /** Moves a Message up (-1) or down (+1). */
  moveBy(id: string, delta: number): Promise<void>
  /** Inserts a Text message right above or below another Message; returns its id. */
  addTextNear(id: string, where: 'above' | 'below', text?: string): Promise<string>
  remove(id: string): Promise<void>
  /** Hears a failed Message again. */
  retry(id: string): Promise<void>
  /** The original file of a Voice note or Video. */
  media(id: string): Promise<Blob | undefined>
  startOver(): Promise<void>
  setDraft(draft: WriteOptions): Promise<void>
  /** Waits for every Message to be heard, writes the Result, keeps it with the Thread and saves it to History. */
  summarize(options: WriteOptions): Promise<ThreadResult>
  /** Resolves once nothing is being heard and nothing that can be heard is waiting. */
  idle(): Promise<void>
}

const CURRENT = 'current'
const MAX_PARALLEL = 2
const MAX_ATTEMPTS = 3

const clampIndex = (at: number, length: number) => Math.max(0, Math.min(at, length))

/**
 * Makes a call to Groq, and while Groq says it is busy waits exactly as long as it asks (its
 * hourly audio limit can mean many minutes) and tries again, up to MAX_ATTEMPTS times.
 * `onWait` is told when the next try will happen, then `undefined` once it starts.
 */
async function withBusyRetries<T>(
  call: () => Promise<T>,
  busyFor: (e: unknown) => number | null | undefined,
  { sleep, now, onWait }: { sleep: (ms: number) => Promise<void>; now: () => number; onWait: (retryAt: number | undefined) => unknown },
): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await call()
    } catch (e) {
      const asked = busyFor(e)
      if (asked === undefined || attempt >= MAX_ATTEMPTS) throw e
      const wait = asked ?? 2000 * attempt
      await onWait(now() + wait)
      await sleep(wait)
      await onWait(undefined)
    }
  }
}

const VIDEO_EXT = /\.(mp4|mov|m4v|mkv|3gp|avi|wmv|mpg|mpeg)$/i

const byName = new Intl.Collator('en', { numeric: true }).compare

// WhatsApp names media PTT-20261011-WA0003.opus: the day it arrived and a running number for
// that day. On phones that order is trustworthy; file dates are often when it was saved or copied.
const WHATSAPP_NAME = /^(?:PTT|AUD|VID)-(\d{8})-WA(\d+)/i
const whatsappKey = (name: string) => {
  const m = WHATSAPP_NAME.exec(name)
  return m ? Number(m[1]) * 1e5 + Number(m[2]) : null
}

/** Puts a batch of files in the order they were sent. */
export function inSentOrder(files: File[]): File[] {
  const keys = files.map(f => whatsappKey(f.name))
  if (keys.every(k => k !== null)) {
    return files.map((f, i) => [f, keys[i]!] as const).sort((a, b) => a[1] - b[1]).map(([f]) => f)
  }
  return [...files].sort((a, b) => a.lastModified - b.lastModified || byName(a.name, b.name))
}

export function kindOf(file: File): MediaKind {
  if (file.type.startsWith('video/')) return 'video'
  if (file.type.startsWith('audio/')) return 'voice'
  return VIDEO_EXT.test(file.name) ? 'video' : 'voice'
}

export async function createThread(deps: {
  db: Db
  keys: KeysStore
  prefs: PrefsStore
  history: History
  fetch: Fetch
  decode: DecodeAudio
  sleep: (ms: number) => Promise<void>
  now: () => number
}): Promise<ThreadStore> {
  const { db, keys, prefs, history, fetch, sleep, now } = deps
  const decode = oneAtATime(deps.decode)
  const saved = await db.get<Partial<ThreadState>>('thread', CURRENT)
  // A Message that was being heard when the page closed is heard again (after any wait Groq asked
  // for), carrying on from the parts already heard.
  const restored = (saved?.messages ?? []).map(m => (m.kind !== 'text' && m.state === 'hearing' ? { ...m, state: 'waiting' as const } : m))
  const state = observable<ThreadState>({ messages: restored, result: saved?.result ?? null, writing: { state: 'idle' }, draft: saved?.draft ?? EMPTY_DRAFT, unsaved: false })
  const active = new Set<Promise<void>>()
  let writer: { key: string; model: string } | null = null
  let watcher: { key: string; model: Promise<string> } | null = null

  /** Saves the Thread. A failure doesn't stop anything, but is shown until a later save works. */
  const persist = async () => {
    const { messages, result, draft } = state.get()
    try {
      await db.put('thread', { messages, result, draft }, CURRENT)
      if (state.get().unsaved) state.publish({ ...state.get(), unsaved: false })
    } catch {
      state.publish({ ...state.get(), unsaved: true })
    }
  }
  async function commit(messages: Message[]) {
    state.publish({ ...state.get(), messages })
    await persist()
  }
  const setWriting = (writing: Writing) => state.publish({ ...state.get(), writing })
  const patchMedia = (messages: Message[], id: string, patch: Partial<MediaMessage>) =>
    messages.map(m => (m.id === id && m.kind !== 'text' ? { ...m, ...patch } : m))
  const update = (id: string, patch: Partial<MediaMessage>) => commit(patchMedia(state.get().messages, id, patch))

  async function hear(message: MediaMessage, key: string) {
    try {
      await update(message.id, { state: 'hearing', failure: undefined })
      const audio = await db.get<Blob>('blobs', message.id)
      if (!audio) return await update(message.id, { state: 'failed', failure: 'unknown' })
      // A wait Groq asked for before the page closed still holds.
      const left = (message.retryAt ?? 0) - now()
      if (left > 0) {
        await sleep(left)
        await update(message.id, { retryAt: undefined })
      }
      // With a Google key, Gemini watches a Video; if it can't, Whisper still hears its sound.
      const google = message.kind === 'video' && audio.size <= GEMINI_MAX_BYTES ? keys.get().gemini : null
      let watchFailure: WatchFailure | undefined
      if (google) {
        try {
          const transcript = await watch(message, audio, google)
          return await update(message.id, { state: 'heard', transcript, retryAt: undefined, watchFailure: undefined })
        } catch (e) {
          watchFailure = e instanceof WatchError ? e.failure : 'unknown'
        }
      }
      try {
        const transcript = await hearFile(audio, message.name, {
          decode,
          send: upload => withBusyRetries(
            () => transcribe(fetch, key, upload),
            e => (e instanceof HearError && e.failure === 'busy' ? e.retryAfterMs : undefined),
            { sleep, now, onWait: retryAt => update(message.id, { retryAt }) },
          ),
          progress: message.parts,
          onProgress: parts => update(message.id, { parts }),
          decodeTries: message.decodeTries ?? 0,
          onDecodeTries: tries => update(message.id, { decodeTries: tries || undefined }),
        })
        return await update(message.id, { state: 'heard', transcript, retryAt: undefined, parts: undefined, watchFailure })
      } catch (e) {
        // Parts already heard are kept, so Try again carries on from the next one.
        return await update(message.id, { state: 'failed', failure: e instanceof HearError ? e.failure : 'unknown', retryAt: undefined })
      }
    } catch {
      // Storage itself failed; never leave the Message looking as if it is still being heard.
      state.publish({ ...state.get(), messages: patchMedia(state.get().messages, message.id, { state: 'failed', failure: 'unknown', retryAt: undefined }) })
    }
  }

  /** Gemini watching a Video, with the newest Flash model the key can use (looked up once per key). */
  async function watch(message: MediaMessage, video: Blob, key: string) {
    if (watcher?.key !== key) watcher = { key, model: chooseWatcher(fetch, key) }
    const model = await watcher.model.catch(e => { watcher = null; throw e })
    return watchVideo(fetch, key, model, video, message.name, message.type, {
      sleep,
      retrying: call => withBusyRetries(
        call,
        e => (e instanceof WatchError && e.failure === 'busy' ? e.retryAfterMs : undefined),
        { sleep, now, onWait: retryAt => update(message.id, { retryAt }) },
      ),
    })
  }

  /** Starts hearing waiting Messages, two at a time. */
  function startHearing() {
    const key = keys.get().groq
    if (!key) return
    for (const m of state.get().messages) {
      if (active.size >= MAX_PARALLEL) return
      if (m.kind === 'text' || m.state !== 'waiting') continue
      // Claim it synchronously so the next call does not start it twice.
      state.publish({ ...state.get(), messages: patchMedia(state.get().messages, m.id, { state: 'hearing' }) })
      const job = hear(m, key).finally(() => { active.delete(job); startHearing() })
      active.add(job)
    }
  }

  let lastKey = keys.get().groq
  keys.subscribe(({ groq }) => {
    if (groq && groq !== lastKey) {
      // A new key: Messages refused because of the old one get another chance.
      const messages = state.get().messages.map(m => (m.kind !== 'text' && m.state === 'failed' && m.failure === 'rejected' ? { ...m, state: 'waiting' as const, failure: undefined } : m))
      state.publish({ ...state.get(), messages })
      void persist()
    }
    lastKey = groq
    startHearing()
  })
  startHearing()

  /** Saves a Result to History. Saving it again replaces it, so this is safe to repeat. */
  const keepInHistory = (result: ThreadResult) => {
    const { messages } = state.get()
    return history.add({
      id: result.id,
      createdAt: result.createdAt,
      mode: result.mode,
      files: messages.flatMap(m => (m.kind === 'text' ? [] : [m.name])),
      title: titleOf(result.text),
      text: result.text,
      cutOff: result.cutOff,
      report: result.report,
    })
  }

  /**
   * After a Result, the next Message added starts a fresh Thread. The Result is saved to History
   * first: the page may have closed before summarize got that far. Says whether it started over.
   */
  async function freshAfterResult() {
    const { result } = state.get()
    if (!result) return false
    await keepInHistory(result)
    await store.startOver()
    return true
  }

  const store: ThreadStore = {
    get: state.get,
    subscribe: state.subscribe,
    async addFiles(files, ids) {
      const known = new Set(state.get().messages.map(m => m.id))
      const idOf = new Map(files.map((f, i) => [f, ids?.[i] ?? crypto.randomUUID()]))
      const sorted = inSentOrder(files.filter(f => !known.has(idOf.get(f)!)))
      if (!sorted.length) return
      await freshAfterResult()
      const added: MediaMessage[] = sorted.map(f => ({ id: idOf.get(f)!, kind: kindOf(f), name: f.name, type: f.type, size: f.size, lastModified: f.lastModified, state: 'waiting' }))
      for (const [i, f] of sorted.entries()) await db.put('blobs', f, added[i].id)
      await commit([...state.get().messages, ...added])
      startHearing()
    },
    async addText(at, text = '') {
      if (await freshAfterResult()) at = 0
      const id = crypto.randomUUID()
      const messages = [...state.get().messages]
      messages.splice(clampIndex(at, messages.length), 0, { id, kind: 'text', text })
      await commit(messages)
      return id
    },
    async setText(id, text) {
      await commit(state.get().messages.map(m => (m.id === id && m.kind === 'text' ? { ...m, text } : m)))
    },
    async move(id, to) {
      const messages = [...state.get().messages]
      const from = messages.findIndex(m => m.id === id)
      if (from < 0) return
      const [m] = messages.splice(from, 1)
      messages.splice(clampIndex(to, messages.length), 0, m)
      await commit(messages)
    },
    async moveBy(id, delta) {
      const from = state.get().messages.findIndex(m => m.id === id)
      if (from >= 0) await store.move(id, from + delta)
    },
    async addTextNear(id, where, text = '') {
      const at = state.get().messages.findIndex(m => m.id === id)
      return store.addText(where === 'above' ? at : at + 1, text) // after a Result, this starts a fresh Thread
    },
    async remove(id) {
      await commit(state.get().messages.filter(m => m.id !== id))
      await db.delete('blobs', id)
    },
    async retry(id) {
      const m = state.get().messages.find(x => x.id === id)
      if (!m || m.kind === 'text' || m.state !== 'failed') return
      // Trying again on purpose also gives a file that kept closing the page another go.
      await update(id, { state: 'waiting', failure: undefined, decodeTries: undefined })
      startHearing()
    },
    media: id => db.get<Blob>('blobs', id),
    async startOver() {
      const ids = state.get().messages.map(m => m.id)
      state.publish({ ...state.get(), messages: [], result: null, writing: { state: 'idle' }, draft: EMPTY_DRAFT })
      await persist()
      for (const id of ids) await db.delete('blobs', id)
    },
    async setDraft(draft) {
      state.publish({ ...state.get(), draft })
      await persist()
    },
    async summarize(options) {
      const fail = (failure: WriteFailure): never => {
        setWriting({ state: 'failed', failure })
        throw new WriteError(failure)
      }
      const key = keys.get().groq
      if (!key) fail('no-key')
      setWriting({ state: 'listening' })
      while (active.size) await Promise.allSettled([...active])
      const { messages } = state.get()
      // Every Voice note and Video failed and there is no Text: say so, rather than "add something".
      if (!canWrite(messages)) fail(messages.some(m => m.kind !== 'text') ? 'nothing-heard' : 'empty')

      setWriting({ state: 'writing' })
      if (writer?.key !== key) writer = { key: key!, model: await chooseWriter(fetch, key!) }
      const prompt = buildPrompt(messages, options, prefs.get().uiLang)
      const model = writer.model
      let written: Written
      try {
        written = await withBusyRetries(
          () => write(fetch, key!, model, prompt),
          e => (e instanceof WriteError && e.failure === 'busy' ? e.retryAfterMs : undefined),
          { sleep, now, onWait: retryAt => setWriting({ state: 'writing', retryAt }) },
        )
      } catch (e) {
        return fail(e instanceof WriteError ? e.failure : 'unknown')
      }
      const { text, cutOff } = written

      const result: ThreadResult = { id: crypto.randomUUID(), createdAt: now(), mode: options.mode, text, cutOff, report: reliabilityReport(messages) }
      state.publish({ ...state.get(), result, writing: { state: 'idle' } })
      await persist()
      try {
        await keepInHistory(result)
      } catch {
        state.publish({ ...state.get(), unsaved: true })
      }
      return result
    },
    async idle() {
      while (active.size) await Promise.allSettled([...active])
    },
  }
  return store
}
